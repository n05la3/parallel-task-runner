import { readonly, ref, type Ref } from 'vue'

export type Job = {
  isRunning?: boolean
  isBlocking?: boolean
  isNonBlocking?: boolean
  error?: {
    message: string
    fullMessage: string
    exception: any
  }
}

const MAX_NUMBER_OF_PARALLEL_JOBS = 4
const MAX_NUMBER_OF_FAILED_JOBS = 10
const JOB_PICKUP_INTERVAL = 500
const FAIL_ON_BLOCKING_JOB_ERROR = true

export function useJobProcessor<T extends Job>({
  onBeforeStart,
  onCleanUp,
  blockJobFn,
  nonBlockJobFn
}: {
  onBeforeStart?: (jobs: T[]) => void
  onCleanUp?: () => void
  blockJobFn?: (job: T) => Promise<unknown>
  nonBlockJobFn?: (job: T) => Promise<unknown>
}) {
  const runningJobs = ref<{ index: number; entry: Job }[]>([])
  const completedJobs = ref<Job[]>([])
  const readyJobs = ref<Job[]>([])
  const failedJobs = ref<Job[]>([])
  let isBlocked = false

  const isRunning = ref(false)

  async function runBlockingJob(entry: Job) {
    if (!entry.isBlocking) {
      throw new Error('Expected to get a directory')
    }
    console.log(`Processing blocking job`)

    return blockJobFn?.(entry as T)
  }

  async function runNonBlockingJob(entry: Job) {
    if (!entry.isNonBlocking) {
      throw new Error('Expected to get a non-blocking job')
    }
    console.log(`Processing non-blocking job`)

    return nonBlockJobFn?.(entry as T)
  }

  function setJobs(jobs: T[]) {
    readyJobs.value = [...jobs]

    onBeforeStart?.(jobs)
  }

  /**
   * Responsible for orchestrating the processor core logic. It schedules jobs, runs them and ensures that the process is stopped when the
   * processing is complete.
   * @param interval A NodeJs.Timer value which has to be used to stop the execution
   * @param resolve Promise resolve argument passed from the caller. Calling it resolves the caller promise..
   */
  function run(interval: NodeJS.Timeout, resolve: (value: unknown) => void) {
    if (readyJobs.value.length === 0) {
      if (runningJobs.value.length === 0) {
        clearInterval(interval)
        resolve(true)
      }
      // All jobs should have been treated. We will return to wait for running ones to complete
      return
    }

    // If there are too many failed jobs then do not process more. This ensures running jobs conclude before resolving
    if (failedJobs.value.length >= MAX_NUMBER_OF_FAILED_JOBS) {
      if (runningJobs.value.length === 0) {
        clearInterval(interval)
        resolve(true)
      }
      // There are already too many failed jobs, so we return in order not to start new ones.
      return
    }

    // Since new jobs are not picked once blocking jobs are being processed, the blocking job should be at the end of the list,
    // so let's check in reverse order
    if (FAIL_ON_BLOCKING_JOB_ERROR) {
      for (let index = failedJobs.value.length - 1; index >= 0; index--) {
        // If there's a directory that failed to create then wait for current running tasks to complete and exit
        if (failedJobs.value[index].isBlocking) {
          if (runningJobs.value.length === 0) {
            clearInterval(interval)
            return resolve(true)
          }
          // Returning here ensures that we do not try to read more entries until the current running ones have completed.
          return
        }
      }
    }

    if (isBlocked) {
      return
    }

    if (MAX_NUMBER_OF_PARALLEL_JOBS - runningJobs.value.length < 1) {
      return
    }

    // It's okay to load more jobs at this point
    const indexOfPoppedFile = readyJobs.value.length - 1
    const currentlyRunningJob = readyJobs.value.pop()

    if (currentlyRunningJob?.isBlocking && indexOfPoppedFile > -1) {
      isBlocked = true
      runningJobs.value.push({ index: indexOfPoppedFile, entry: currentlyRunningJob })

      runBlockingJob(currentlyRunningJob)
        .then((result) => {
          completedJobs.value.push(currentlyRunningJob)
        })
        .catch((error) => {
          currentlyRunningJob.error = {
            message: 'Network Error',
            fullMessage: '',
            exception: error
          }

          // Placed the running job in the failed state
          failedJobs.value.push(currentlyRunningJob)
          console.error(error)
        })
        .finally(() => {
          isBlocked = false

          // Whether the job failed or succeeded, we remove the job from the running state
          const runningIndex = runningJobs.value.findIndex(
            ({ index }) => index === indexOfPoppedFile
          )
          if (runningIndex !== -1) {
            runningJobs.value.splice(runningIndex, 1)
          }
        })
    }
    if (currentlyRunningJob?.isNonBlocking) {
      runningJobs.value.push({ index: indexOfPoppedFile, entry: currentlyRunningJob })

      runNonBlockingJob(currentlyRunningJob)
        .then(() => {
          completedJobs.value.push(currentlyRunningJob)
        })
        .catch((error) => {
          // Write the error message
          currentlyRunningJob.error = {
            message: 'Network Error',
            fullMessage: '',
            exception: error
          }
          // Mark the file as failed, so that it can be retried
          failedJobs.value.push(currentlyRunningJob)
        })
        .finally(() => {
          // Always remove the file from the running state whether it failed or succeeded
          const runningIndex = runningJobs.value.findIndex(
            ({ index }) => index === indexOfPoppedFile
          )
          if (runningIndex !== -1) {
            runningJobs.value.splice(runningIndex, 1)
          }
        })
    }
  }

  /**
   * Cleans up the state so that new upload jobs can be started using the same instance.
   */
  function cleanUp() {
    readyJobs.value = []
    runningJobs.value = []
    completedJobs.value = []
    failedJobs.value = []
    isRunning.value = false

    onCleanUp?.()
  }

  /**
   * It is responsible for starting the runner and reacting to response from the runner.
   * @param jobs The jobs to be executed. Jobs can be blocking or non-blocking.
   */
  async function start(jobs?: T[], isRetrying?: boolean) {
    if (!isRetrying && (isRunning.value || readyJobs.value.length !== 0)) {
      console.error('Cannot start an upload process while another is not completed')
      return
    }
    if (jobs) {
      setJobs(jobs)
    }

    // For the very first run, if the first `MAX_NUMBER_OF_PARALLEL_JOBS` are non-blocking then we can push them
    // to the running state so that they start running immediately.

    isRunning.value = true
    return new Promise((resolve, reject) => {
      const interval = setInterval(function () {
        try {
          run(interval, resolve)
        } catch (error) {
          clearInterval(interval)
          reject(error)
        }
      }, JOB_PICKUP_INTERVAL)
    })
      .then(() => {
        if (completedJobs.value.length !== 0) {
          // Do something when completed
        }
        if (failedJobs.value.length !== 0) {
          // Do something when failed
        } else {
          // Do something when successful
          cleanUp()
        }
      })
      .catch(() => {
        cleanUp()
      })
      .finally(() => {
        isRunning.value = false
      })
  }

  /**
   *  Call to retry the upload.
   */
  async function retryUpload() {
    if (failedJobs.value.length !== 0) {
      // The ready jobs here are the ones that never started running before failing while the failed jobs are the
      // ones that failed after running.
      readyJobs.value = [...readyJobs.value, ...failedJobs.value]
    }
    runningJobs.value = []
    failedJobs.value = []

    start(undefined, true)
  }

  return {
    isRunning: readonly(isRunning as Ref<boolean>),
    failedJobs: readonly(failedJobs as Ref<T[]>),
    queuedJobs: readonly(readyJobs as Ref<T[]>),
    runningJobs: readonly(runningJobs as Ref<{ index: number; entry: T }[]>),
    completedJobs: readonly(completedJobs as Ref<T[]>),

    start,
    retryUpload,
    cleanUp
  }
}
