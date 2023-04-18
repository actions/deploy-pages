# deploy-pages 🚀

[![Check distributables](https://github.com/actions/deploy-pages/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/deploy-pages/actions/workflows/check-dist.yml) [![Check linter](https://github.com/actions/deploy-pages/actions/workflows/check-linter.yml/badge.svg)](https://github.com/actions/deploy-pages/actions/workflows/check-linter.yml) [![Checking formatting](https://github.com/actions/deploy-pages/actions/workflows/check-formatting.yml/badge.svg)](https://github.com/actions/deploy-pages/actions/workflows/check-formatting.yml) [![Run Tests](https://github.com/actions/deploy-pages/actions/workflows/test.yml/badge.svg)](https://github.com/actions/deploy-pages/actions/workflows/test.yml) [![CodeQL](https://github.com/actions/deploy-pages/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/deploy-pages/actions/workflows/codeql-analysis.yml) [![coverage](./badges/coverage.svg)](./badges/coverage.svg)

This action is used to deploy [Actions artifacts][artifacts] to [GitHub Pages](https://pages.github.com/).

## Usage

See [action.yml](action.yml) for the various `inputs` this action supports.

For examples that make use of this action, check out our [starter-workflows][starter-workflows] in a variety of frameworks.

This action expects an artifact named `github-pages` to have been created prior to execution. This is done automatically using [`actions/upload-pages-artifact`][upload-pages-artifact].

We recommend this action to be used in a dedicated job:

```yaml
jobs:
  # Build job
  build:
    # <Not provided for brevity>
    # At a minimum this job should upload artifacts using actions/upload-pages-artifact

  # Deploy job
  deploy:
    # Add a dependency to the build job
    needs: build

    # Grant GITHUB_TOKEN the permissions required to make a Pages deployment
    permissions:
      pages: write      # to deploy to Pages
      id-token: write   # to verify the deployment originates from an appropriate source

    # Deploy to the github-pages environment
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    # Specify runner + deployment step
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@vX.X.X # <--- The latest version of this action
```

### Inputs 📥

| Input | Required? | Default | Description |
| ----- | --------- | ------- | ----------- |
| `token` | `true` | `${{ github.token }}` | The GitHub token used to create an authenticated client - Provided for you by default! |
| `emit_telemetry` | `false` | `"false"` | Should this action only emit build telemetry instead of deploying the build artifact? |
| `conclusion` | `false` | - | The status of the previous build |
| `timeout` | `false` | `"600000"` | Time in milliseconds after which to timeout and cancel the deployment (default: 10 minutes) |
| `error_count` | `false` | `"10"` | Maximum number of status report errors before cancelling a deployment (default: 10) |
| `reporting_interval` | `false` | `"5000"` | Time in milliseconds between two deployment status report (default: 5 seconds) |
| `artifact_name` | `false` | `"github-pages"` | The name of the artifact to deploy |
| `preview` | `false` | `"false"` | Is this attempting to deploy a pull request as a GitHub Pages preview site? (NOTE: This feature is only in alpha currently and is not available to the public!) |

### Outputs 📤

| Output | Description |
| ------ | ----------- |
| `page_url` | The URL of the deployed Pages site |

### Environment Variables 🌎

| Variable | Description |
| -------- | ----------- |
| `GITHUB_PAGES` | This environment variable is created and set to the string value `"true"` so that framework build tools may choose to differentiate their output based on the intended target hosting platform. |

## Scope

⚠️ Official support for building Pages with Actions is in public beta at the moment.

## Security Considerations

There are a few important considerations to be aware of:

1. The artifact being deployed must have been uploaded in a previous step, either in the same job or a separate job that doesn't execute until the upload is complete.

2. The job that executes the deployment must at minimum have the following permissions:
   - `pages: write`
   - `id-token: write`

3. The deployment should target the `github-pages` environment (you may use a different environment name if needed, but this is not recommended.)

4. If your Pages site is using a source branch, the deployment must originate from this source branch unless [your environment is protected][environment-protection] in which case the environment protection rules take precedence over the source branch rule

5. If your Pages site is using GitHub Actions as the source, while not required we highly recommend you also [protect your environment][environment-protection] (we will configure it by default for you).

## Release Instructions

In order to release a new version of this Action:

1. Locate the semantic version of the [upcoming release][release-list] (a draft is maintained by the [`draft-release` workflow][draft-release]).

2. Publish the draft release from the `main` branch with semantic version as the tag name, _with_ the checkbox to publish to the GitHub Marketplace checked. :ballot_box_with_check:

3. After publishing the release, the [`release` workflow][release] will automatically run to create/update the corresponding the major version tag such as `v1`.

   ⚠️ Environment approval is required. Check the [Release workflow run list][release-workflow-runs].

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

<!-- references -->
[starter-workflows]: https://github.com/actions/starter-workflows/tree/main/pages
[upload-pages-artifact]: https://github.com/actions/upload-pages-artifact
[artifacts]: https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts
[environment-protection]: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules
[release-list]: https://github.com/actions/deploy-pages/releases
[draft-release]: .github/workflows/draft-release.yml
[release]: .github/workflows/release.yml
[release-workflow-runs]: https://github.com/actions/deploy-pages/actions/workflows/release.yml
