## [1.3.1](https://github.com/Emengkeng/ethglobal-nlp-ai/compare/v1.3.0...v1.3.1) (2025-02-03)


### Bug Fixes

* trying to fix communication with agent ([58c619e](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/58c619ef3700ea12194a9f801d946067a474bb5a))

# [1.3.0](https://github.com/Emengkeng/ethglobal-nlp-ai/compare/v1.2.0...v1.3.0) (2025-02-03)


### Features

* added proper logging with winston ([49eae36](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/49eae36e669a64eba248dea72fbc848db74b38ad))

# [1.2.0](https://github.com/Emengkeng/ethglobal-nlp-ai/compare/v1.1.0...v1.2.0) (2025-02-03)


### Bug Fixes

* creating a centralized MessageQueue instance to avoid errors ([a07715e](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/a07715ef81f5f76907de6f834d078070b0d44082))
* import errors ([594206a](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/594206a77fed85e60cf0d2c1aeca76b60e83ffcd))
* initialized MessageQueue before starting the server ([92e87e3](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/92e87e31356c96e01925d9345a587e4d00d5b644))
* method missing the userId property ([f5c3375](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/f5c3375a28fe6edb886ad595d123b6f7f8cafcda))


### Features

* move logger to utils ([24b86aa](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/24b86aa133281bb29058a549f89552cb22e6d346))

# [1.1.0](https://github.com/Emengkeng/ethglobal-nlp-ai/compare/v1.0.1...v1.1.0) (2025-02-03)


### Bug Fixes

* docker works properly with deployment ([18450a8](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/18450a8add0d549b9268a4734fed14a8e169ea5c))
* life cycle now uses docker deployment script ([5f200b0](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/5f200b074c50ea87c405da00a341fafae38c2710))
* modified DockerDeployment class to handle image building ([06e05af](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/06e05af548b25ca5edc4b666efd1faa9610520ed))
* msg implicitly has any type ([78186ea](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/78186ea473c650cd6961d5c3296928011e361a22))
* property clleanup does not exist on type MessageQueue ([1dbf286](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/1dbf2863495abeed954353c6a0b5cb0d560dd4a5))
* type error ([be4aa8a](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/be4aa8a2f544c971fc90d971d06f9024e17d656d))
* type issues ([30a4115](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/30a41150df4f345bc58d555e0d7d11bdcc456ee9))


### Features

* ability for multi user usage, and isolation of each agent vai docker ([764f02b](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/764f02bdd5d9fc2e1f7a70bb4063c9b4bcb74e1d))
* ability to stop all agents on the system ([c2d8885](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/c2d8885a0ff880ecb3e25436daed83a966807523))
* added cleanup for graceful shutdown ([7e56857](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/7e5685749d9c300671029cc22f34e57e1c68c37f))
* added docker file ([8c2a768](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/8c2a768d14433f19286cf6da0fd0ac288a11f63f))
* agent container with message handling ([3b4b75a](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/3b4b75a2dbf5db5497fe1f5cc41c7980445913c1))
* cleanup and added needed import ([4c5c1e5](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/4c5c1e5abbf97ecdd563ff2b5952060dfaa33064))
* created file to break down large codebase ([e73c9bc](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/e73c9bc74ca101af65740953d840e8bbd3aacb4f))
* file structure for support of multiple users vai agent ([7bff635](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/7bff635913db568118e2efbd85887d6049d4d32e))
* installed needed packages to extend agent to multi users ([3feee13](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/3feee1318851fdd71368396e5fb112ea9d832862))
* message queue for communication with isolated agents ([726591e](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/726591e418cd25502c65b955d19b7df59b823f0c))
* not more than 1 agents can be created per user and 2 for the system ([8125077](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/81250772a7afe22b2d29bbe192ab947f0514c7fd))
* proper route management and application startup ([9dcb3a2](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/9dcb3a2539dd361dbeaee1ea0095606f453da2d5))
* separated agent state and error ([dba0521](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/dba052108e4ca46f5949d1958b97f222540a556d))

## [1.0.1](https://github.com/Emengkeng/ethglobal-nlp-ai/compare/v1.0.0...v1.0.1) (2025-02-01)


### Bug Fixes

* The modeGrok error of l expects a single  element per message ([db3a8ae](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/db3a8aee9a375f88de1a8df3927eda9f216756a6))
* wrong main function in file ([405e4f8](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/405e4f874814861f259ca437d5fee7efd4cbe9eb))

# 1.0.0 (2025-02-01)


### Bug Fixes

* installed all packages needed by semantic release ([b57d1c4](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/b57d1c4bb406dfbfad3943a36fbf8b34713a1242))
* remove line of code not needed ([1fa658d](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/1fa658df4568da375b947376054194d8fffbd74d))
* semantic workflow issues ([07a1d08](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/07a1d08d7ad2ac48098ec9d2d1f1a76670b73b9d))
* switch from pnpm to npm in ci/cd ([1b47970](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/1b47970690688d3369c85e527a99362516831241))
* swrong node action in ci/cd yml ([4bef6a6](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/4bef6a6676e9a825fdba8704084280fec2d071dc))
* updated the workflow file to be more explicit about error handling and add some logging ([8152ba5](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/8152ba53ed1fa21c08bc4fd83061e7d5da70b35f))


### Features

* added required file modules and created env example ([88ed848](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/88ed8486430a8ff99e56da7c4354d3980c3d0350))
* clean up cdp template kit, with proper env management ([f2bd42f](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/f2bd42fcccb6c4644b928327338328323dbf6f19))
* clean up cdp template kit, with proper types ([96c5ee8](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/96c5ee825fe53e006857cd270302caafea3f35e8))
* clean up cdp template kit. clean controllers ([43380b1](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/43380b1017e444a66bc9979d3486a0d9194bb007))
* clean up cdp template kit. good management of constant and additionla logging ([43bf047](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/43bf047c557aa48d164c2129dc6ba64525acc23b))
* clean up cdp template kit. proper code management for core services ([0ee6812](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/0ee681230f769a48dcedbb1072dec9304682ed5b))
* clean up cdp template kit. proper error handling ([bb28ef3](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/bb28ef351db994347943a167c7f7a225d113e36d))
* clean up cdp template kit. proper index file ([8cad024](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/8cad02487d0aaa02bff024ce2b16c43205f680e4))
* create workflow foci/cd r semantic release ([503322b](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/503322bad411ff7bb904ba99e74665f4c0920988))
* use of sematic release for auto versioning ([c461a0f](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/c461a0f797d6d6df855c5995555ff37d107a19ac))
* useing gitpod for devlopement ([fdcac96](https://github.com/Emengkeng/ethglobal-nlp-ai/commit/fdcac968e1dfa377d6f95ddcfeac28205a12c97e))
