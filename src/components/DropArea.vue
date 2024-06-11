<script setup lang="ts">
import { useDragDropProcessor } from '@/app'
import type { FileOrDirectoryJob } from './DropArea'

type FileOrDirectory = FileOrDirectoryJob & {
  isDirectory?: boolean
}

const { start } = useDragDropProcessor()

function readFileFromFileSystem(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(
      (entry) => {
        resolve(entry)
      },
      (error) => {
        reject(error)
      }
    )
  })
}

function readDirectoryEnties(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(
      (entries) => {
        resolve(entries)
      },
      (error) => {
        reject(error)
      }
    )
  })
}

function reorderFiles(files: FileOrDirectory[]) {
  const filesInFileSystem: FileOrDirectory[] = []

  function sortFiles(files: FileOrDirectory[]) {
    for (const entry of files) {
      if (entry.isFile) {
        filesInFileSystem.push(entry)
      }
    }
    for (const entry of files) {
      if (entry.isDirectory) {
        filesInFileSystem.push(entry)
      }
      if (entry.children && entry.children.length > 0) {
        sortFiles(entry.children)
      }
    }
  }
  sortFiles(files)

  // At this point, directories are placed before their children. Since we will be popping the files to create them
  // we reverse the order so that the creation can happen in the correct order
  return filesInFileSystem.reverse()
}

function isFile(fileEntry: FileSystemEntry): fileEntry is FileSystemFileEntry {
  return fileEntry.isFile
}
async function extractFilesDropped(files: FileSystemEntry[]) {
  const filesFound: FileOrDirectory[] = []

  for (const fileEntry of files) {
    const isRoot = fileEntry.fullPath.split('/').length - 1 === 1

    if (isFile(fileEntry)) {
      filesFound.push({
        name: fileEntry.name,
        isFile: true,
        isDirectory: false,
        fullPath: fileEntry.fullPath,
        file: await readFileFromFileSystem(fileEntry),
        isRoot
      })

      continue
    }

    const directoryReader = (fileEntry as FileSystemDirectoryEntry).createReader()

    const filesInDirectory: FileSystemEntry[] = []
    let fileBatch: FileSystemEntry[] = []

    // There's a browser limitation that prevents reading more than 100 files at a time, so we need to read them in batches
    // until there are no more files to read
    do {
      fileBatch = await readDirectoryEnties(directoryReader)
      filesInDirectory.push(...fileBatch)
    } while (fileBatch.length > 0)

    filesFound.push({
      name: fileEntry.name,
      isFile: false,
      isDirectory: true,
      fullPath: fileEntry.fullPath,
      children: await extractFilesDropped(filesInDirectory),
      isRoot
    })
  }

  return filesFound
}

async function dropHander(event: DragEvent) {
  // Do not attempt to handle the drop if it is not a file/folder drop or if there are no files/folders
  if (
    !event.dataTransfer ||
    event.dataTransfer?.items.length === 0 ||
    event.dataTransfer?.items[0].kind !== 'file'
  ) {
    console.log('Not a file drop')
    return
  }

  const filesFound = Array.from(event.dataTransfer.items).flatMap((item) => {
    const file = item.webkitGetAsEntry()
    try {
      if (!file) {
        return []
      }

      return file
    } catch (error) {
      console.error('Atleast one file could not be read', error)
      return []
    }
  })

  const filesRead = await extractFilesDropped(filesFound)

  const reorderedFiles = await reorderFiles(filesRead)

  console.log('Reordered files', reorderedFiles)

  const files = reorderedFiles.map((entry) => ({
    ...entry,
    isBlocking: entry.isDirectory,
    isNonBlocking: entry.isFile
  }))

  start(files)
}
</script>

<template>
  <div class="drop-container" @dragover.prevent @drag.prevent @drop.stop.prevent="dropHander">
    <div>Drop files/folders here to upload</div>
  </div>
</template>

<style scoped>
.drop-container {
  margin-top: 64px;
  color: rgba(255, 255, 255, 0.78);
  height: 50vh;
  width: 50vw;
  border: 1px dashed #ccc;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
./drop-area
