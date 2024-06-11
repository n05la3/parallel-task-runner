# A Simple Parallel and Controlled Task Runner in JavaScript

This Repo provides a practical example of the concepts explored in the articles [to-be-filled]() and [to-be-filled](). The demonstrations here are implemented in Vue 3. The runner itself is not Vue specific. Its core logic can be easily ported to any framework.

The runner supports blocking and non-blocking tasks. Once a blocking task is being executed, the runner will not run any other tasks until the blocking task is completed. This means that if all tasks to run are blocking, then the runner runs them one after the other and not in parallel.

The runner maintains a fixed number of concurrent tasks. It ensures that the number of running tasks never exceeds the concurrency limit. A value of `4` parallel tasks has been used in the demonstrations. You can modify that value and watch it behave differently.

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```

## The Runner in action

Below is a demonstration of the runner picking up files from a list of files dropped from the file system.

To try it out, run `pnpm dev`, drag some files from the file system into the `Drop Files` area and watch it process each file.

The files don't get uploaded to any server, we are simply mocking that with a timeout. That could be replaced with a `fetch` call to your server.

![Simple Parallel Task Runner](./src/assets/parallel-task-processor.gif)
