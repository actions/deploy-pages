# Contributing 💻

All contributions are welcome and greatly appreciated!

## Steps to Contribute 💡

> Check the `.node-version` file in the root of this repo so see what version of Node.js is required for local development - note, this can be different from the version of Node.js which runs the Action on GitHub runners. It is suggested to download [nodenv](https://github.com/nodenv/nodenv) which uses this file and manages your Node.js versions for you

1. Fork this repository
2. Make your changes
3. [Test](#testing-) your changes locally
4. Before opening a pull request, please run `npm run all` to verify formatting, linting, tests, generated files, etc.
5. Commit and push your changes to your fork
6. Open a pull request back to this repository
7. Wait for an approval or changes requested from the maintainers of this repository

After merging the pull request, the maintainers of this repository will create a new release with those changes included. After that, everyone can utilize the newly integrated changes in their own Actions workflows and enjoy your awesome improvements!

## Testing 🧪

### Running the test suite (required)

Simply run the following command to execute the entire test suite:

```bash
npm test
```

> Note: This requires that you have already run `npm install`.
