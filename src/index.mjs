import { DefaultArtifactClient } from '@actions/artifact'
import apiClient from './internal/api-client.js'
import action from './index.js'

apiClient.setArtifactClient(DefaultArtifactClient)
action.main()
