import * as xlsx from 'xlsx'

export interface XlsxSheetImage {
  dataUrl: string
  path: string
  width: number
  height: number
  area: number
}

interface CfbEntry {
  name?: string
  type?: number
  content?: ArrayBuffer | Uint8Array | number[] | string
}

interface CfbPackage {
  FullPaths?: string[]
  FileIndex?: CfbEntry[]
}

interface Relationship {
  id: string
  target: string
  type: string
  path: string
}

const textDecoder = new TextDecoder()

export function extractCharacterSheetPngs(
  buffer: ArrayBuffer,
  sheetName = '人物'
): XlsxSheetImage[] {
  try {
    const files = readPackageFiles(buffer)
    const workbook = readXml(files, 'xl/workbook.xml')
    if (!workbook) return []

    const workbookRels = readRels(files, 'xl/workbook.xml')
    const sheetPart = findSheetPart(workbook, workbookRels, sheetName)
    if (!sheetPart) return []

    return [
      ...collectDrawingImagesForSheet(files, sheetPart),
      ...collectCellImagesFallback(files, sheetPart)
    ]
  } catch {
    return []
  }
}

function readPackageFiles(buffer: ArrayBuffer): Map<string, Uint8Array> {
  const cfb = xlsx.CFB.read(new Uint8Array(buffer), { type: 'buffer' }) as CfbPackage
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < (cfb.FullPaths?.length ?? 0); i++) {
    const rawPath = cfb.FullPaths?.[i]
    const entry = cfb.FileIndex?.[i]
    if (!rawPath || !entry?.content) continue
    const path = normalizePath(rawPath)
    if (!path || path.endsWith('/')) continue
    files.set(path.toLowerCase(), toUint8Array(entry.content))
  }
  return files
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^Root Entry\//, '')
    .replace(/^\/+/, '')
}

function toUint8Array(content: ArrayBuffer | Uint8Array | number[] | string): Uint8Array {
  if (content instanceof Uint8Array) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
  }
  if (content instanceof ArrayBuffer) return new Uint8Array(content)
  if (typeof content == 'string') {
    const bytes = new Uint8Array(content.length)
    for (let i = 0; i < content.length; i++) bytes[i] = content.charCodeAt(i) & 0xff
    return bytes
  }
  return new Uint8Array(content)
}

function readBytes(files: Map<string, Uint8Array>, path: string): Uint8Array | undefined {
  return files.get(normalizePath(path).toLowerCase())
}

function readXml(files: Map<string, Uint8Array>, path: string): Document | null {
  const bytes = readBytes(files, path)
  if (!bytes) return null
  return parseXml(textDecoder.decode(bytes))
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function elementsByLocalName(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.localName == name)
}

function getAttr(element: Element, localName: string): string {
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i]
    if (attr.localName == localName || attr.name == localName) return attr.value
  }
  return ''
}

function readRels(files: Map<string, Uint8Array>, sourcePart: string): Map<string, Relationship> {
  const doc = readXml(files, relsPathFor(sourcePart))
  const rels = new Map<string, Relationship>()
  if (!doc) return rels
  for (const rel of elementsByLocalName(doc, 'Relationship')) {
    const id = getAttr(rel, 'Id')
    const target = getAttr(rel, 'Target')
    const type = getAttr(rel, 'Type')
    if (!id || !target) continue
    rels.set(id, {
      id,
      target,
      type,
      path: resolvePartPath(sourcePart, target)
    })
  }
  return rels
}

function relsPathFor(sourcePart: string): string {
  const part = normalizePath(sourcePart)
  const slash = part.lastIndexOf('/')
  const dir = slash >= 0 ? part.slice(0, slash) : ''
  const file = slash >= 0 ? part.slice(slash + 1) : part
  return `${dir}/_rels/${file}.rels`
}

function resolvePartPath(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return normalizePath(target)
  const source = normalizePath(sourcePart)
  const slash = source.lastIndexOf('/')
  const base = slash >= 0 ? source.slice(0, slash).split('/') : []
  for (const segment of target.split('/')) {
    if (!segment || segment == '.') continue
    if (segment == '..') base.pop()
    else base.push(segment)
  }
  return base.join('/')
}

function findSheetPart(
  workbook: Document,
  workbookRels: Map<string, Relationship>,
  sheetName: string
): string {
  const sheet = elementsByLocalName(workbook, 'sheet').find(
    (element) => element.getAttribute('name') == sheetName
  )
  if (!sheet) return ''
  const relId = getAttr(sheet, 'id')
  return workbookRels.get(relId)?.path ?? ''
}

function collectDrawingImagesForSheet(
  files: Map<string, Uint8Array>,
  sheetPart: string
): XlsxSheetImage[] {
  const sheet = readXml(files, sheetPart)
  if (!sheet) return []
  const sheetRels = readRels(files, sheetPart)
  const images: XlsxSheetImage[] = []

  for (const drawing of elementsByLocalName(sheet, 'drawing')) {
    const relId = getAttr(drawing, 'id')
    const drawingPart = sheetRels.get(relId)?.path
    if (!drawingPart) continue
    images.push(...collectDrawingImages(files, drawingPart))
  }

  return images
}

function collectDrawingImages(
  files: Map<string, Uint8Array>,
  drawingPart: string
): XlsxSheetImage[] {
  const drawing = readXml(files, drawingPart)
  if (!drawing) return []
  const rels = readRels(files, drawingPart)
  const images: XlsxSheetImage[] = []

  for (const pic of elementsByLocalName(drawing, 'pic')) {
    const blip = elementsByLocalName(pic, 'blip')[0]
    const relId = blip ? getAttr(blip, 'embed') || getAttr(blip, 'link') : ''
    const mediaPart = rels.get(relId)?.path ?? ''
    const image = imageFromMedia(files, mediaPart)
    if (image) images.push(image)
  }

  return images
}

function collectCellImagesFallback(
  files: Map<string, Uint8Array>,
  sheetPart: string
): XlsxSheetImage[] {
  const sheetBytes = readBytes(files, sheetPart)
  if (!sheetBytes) return []
  const sheetText = textDecoder.decode(sheetBytes)
  if (!/DISPIMG|IMAGE\(/i.test(sheetText)) return []

  const cellImagesPart = 'xl/cellimages.xml'
  const cellImages = readXml(files, cellImagesPart)
  if (!cellImages) return []
  const rels = readRels(files, cellImagesPart)
  const images: XlsxSheetImage[] = []
  for (const pic of elementsByLocalName(cellImages, 'pic')) {
    const blip = elementsByLocalName(pic, 'blip')[0]
    const relId = blip ? getAttr(blip, 'embed') || getAttr(blip, 'link') : ''
    const mediaPart = rels.get(relId)?.path ?? ''
    const image = imageFromMedia(files, mediaPart)
    if (image) images.push(image)
  }
  return images
}

function imageFromMedia(files: Map<string, Uint8Array>, mediaPart: string): XlsxSheetImage | null {
  if (!/\.png$/i.test(mediaPart)) return null
  const bytes = readBytes(files, mediaPart)
  if (!bytes) return null
  const size = pngSize(bytes)
  if (!size) return null
  return {
    dataUrl: `data:image/png;base64,${bytesToBase64(bytes)}`,
    path: mediaPart,
    width: size.width,
    height: size.height,
    area: size.width * size.height
  }
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!signature.every((value, idx) => bytes[idx] == value)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false)
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
