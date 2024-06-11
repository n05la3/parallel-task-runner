<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useJobProcessor } from './components/upload-processor'
import { provideFileProcessorHandler } from './app'
import { computed, ref } from 'vue'
import type { FileOrDirectoryJob } from './components/drop-area'

const rootFileJobsToRun = ref<FileOrDirectoryJob[]>([])

// Gets a random timeout between 500 and 1m milliseconds
function getRandomTimeoutPromise(canFail?: boolean) {
  return new Promise((resolve, reject) => {
    // Select a random timeout between 500ms and 7000ms
    const randomTimeout = Math.floor(Math.random() * (7000 - 500 + 1)) + 500
    console.log('Will run for: ', `${randomTimeout / 1000}s`)

    if (!canFail) {
      return setTimeout(resolve, randomTimeout)
    }

    const throwError = Math.random() < 0.1
    if (throwError) {
      reject(new Error('Random error occurred!'))
    }
    setTimeout(resolve, randomTimeout)
  })
}

const handlerState = useJobProcessor({
  onBeforeStart: setFileJobs,
  onCleanUp: () => {
    rootFileJobsToRun.value = []
  },
  blockJobFn: (job) => getRandomTimeoutPromise(job.isFile),
  nonBlockJobFn: (job) => getRandomTimeoutPromise(job.isFile)
})

// We provide in main layout so that when switching between pages in this layout, the upload will continue
provideFileProcessorHandler(handlerState)

const { isRunning, failedJobs, completedJobs, runningJobs, retryUpload, cleanUp } = handlerState

const getRootPath = (fullPath: string) => fullPath.split('/')[1]
function setFileJobs(files: FileOrDirectoryJob[]) {
  rootFileJobsToRun.value = files.flatMap((entry) => {
    if (!entry.isRoot) {
      return []
    }

    const numberOfEntriesInFolder = entry.isBlocking
      ? files.reduce((acc, file) => {
          if (getRootPath(file.fullPath) === getRootPath(entry.fullPath)) {
            return acc + 1
          }
          return acc
        }, 0)
      : 0

    return {
      ...entry,
      numberOfEntriesInFolder,
      numberOfRuns: 0
    }
  })
}

const rootFiles = computed(() =>
  rootFileJobsToRun.value
    .map((file) => {
      const isRunning = runningJobs.value.some(({ entry }) => {
        return file.isFile
          ? entry.fullPath === file.fullPath
          : getRootPath(entry.fullPath) === getRootPath(file.fullPath)
      })

      const numberOfRuns = completedJobs.value.reduce((acc, curr) => {
        if (getRootPath(curr.fullPath) === getRootPath(file.fullPath)) {
          return acc + 1
        }
        return acc
      }, 0)

      const hasFailed = failedJobs.value.some(
        ({ fullPath }) =>
          fullPath === file.fullPath || getRootPath(fullPath) === getRootPath(file.fullPath)
      )

      return {
        ...file,
        isRunning,
        numberOfRuns,
        hasCompleted: file.isBlocking
          ? numberOfRuns === file.numberOfEntriesInFolder
          : numberOfRuns !== 0,
        hasFailed
      }
    })
    // Because files wich were executed last are at the start of the array, we reverse to get a correct
    // UI display with the correct order from top to bottom
    .reverse()
)

function closeStatusCard() {
  cleanUp()
  rootFileJobsToRun.value = []
}
</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/about">About</RouterLink>
  </nav>

  <div v-if="rootFiles.length !== 0" class="upload-status-card">
    <div>
      <div v-for="entry in rootFiles" :key="entry.fullPath" class="row-status-item">
        <span>{{ entry.name }}</span>
        <div class="row-status-item">
          <div class="spinner" v-if="entry.isRunning"></div>

          <img
            v-else-if="entry.hasCompleted"
            src="@/assets/check-circle.svg"
            height="20"
            width="20"
          />
          <img v-else-if="entry.hasFailed" src="@/assets/close-circle.svg" height="20" width="20" />
          <span v-if="entry.isBlocking">
            {{ `${entry.numberOfRuns}/${entry.numberOfEntriesInFolder}` }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="!isRunning && failedJobs.length !== 0" class="row-status-item">
      <button class="retry-button" @click="closeStatusCard">Close</button>
      <button class="retry-button" @click="retryUpload">Retry</button>
    </div>
  </div>

  <RouterView />
</template>

<style scoped>
nav {
  width: 100%;
  font-size: 16px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

.upload-status-card {
  width: 500px;
  height: 400px;
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  right: 16px;
  background-color: rgba(255, 255, 255, 0.9);
  top: 16px;
  border-radius: 8px;
  padding: 16px;
  color: rgba(0, 0, 0, 0.78);
  line-height: 40px;

  overflow: auto;
}

.row-status-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
  gap: 16px;

  font-size: 16px;
}

.retry-button {
  display: inline-block;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 20px;
  background-color: #d2b48c;
  color: #fff;
  transition: background-color 0.2s ease-in-out;

  &:hover {
    background-color: #c0a07c;
  }
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(52, 152, 219, 0.4);
  border-radius: 50%;
  border-top-color: #3498db;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
