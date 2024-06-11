import type { Job } from './upload-processor'

export type FileOrDirectoryJob = Job &
  Pick<FileSystemEntry, 'name' | 'isFile' | 'fullPath'> & {
    isRoot: boolean
    file?: File
    numberOfEntriesInFolder?: number
    numberOfRuns?: number
    children?: FileOrDirectoryJob[]
  }
