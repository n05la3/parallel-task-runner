import { inject, provide, type InjectionKey } from 'vue'
import type { FileOrDirectoryJob } from './components/drop-area'

type FolderDragDropJob = {
  // Add the other returned types from `useUploadProcessor` here to be able to inject with type safety
  retryUpload: () => void
  start: (files: FileOrDirectoryJob[]) => void
}

const appDragDrop: InjectionKey<FolderDragDropJob> = Symbol('fileEntryDragDrop')

export function provideFileProcessorHandler(state: FolderDragDropJob) {
  provide(appDragDrop, state)
}

export function useDragDropProcessor() {
  const state = inject(appDragDrop)
  if (!state) {
    throw new Error(
      'File processor handler is not provided. It seems provideFileProcessorHandler() has not been called?'
    )
  }
  return state
}
