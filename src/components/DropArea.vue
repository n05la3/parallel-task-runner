<script setup lang="ts">
function readFileFromFileSystem(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(
      (readFile) => {
        resolve(readFile)
      },
      (error) => {
        reject(error)
      }
    )
  })
}
function extractFilesFromDrag() {}

function dropHander(event: DragEvent) {
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
      console.error('Error occurred reading the file')
    }
  })
  console.log(filesFound)
}
</script>

<template>
  <div class="drop-container" @dragover.prevent @drag.prevent @drop.stop.prevent="dropHander">
    <div>Drop files/folders here to upload</div>
  </div>
</template>

<style scoped>
.drop-container {
  height: 60vh;
  width: 100%;
  border: 1px dashed #ccc;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
