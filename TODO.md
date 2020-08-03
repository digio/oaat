TODO:

Commands:
- [-] amuck record 
  - [x] Do most things, including linking to linting task
  - [x] Need a way to indicate that certain endpoints should not be recorded (status code > 1000?
- [x] amuck lint
  - [x] Add config file support, to customise linting
  - [x] Linting could add examples from x-examples into the parameters[].examples and requestBody.examples,
        with async values (vis script) being used
- [ ] amuck build
  - [x] Convert existing code to new style
  - [x] Add support for customising web template (even using your own?)
  - [x] Add a different message depending on whether normal/mock/proxy being used 
  - [x] Add x-ignore to the website and specFileEndpoints 
- [ ] amuck compare
  - [x] Add jest-diff to compare responses
  - [ ] Add e2e tests
  - [ ] Add unit tests
- [ ] amuck deploy
  - To be implemented. Uses the script from https://github.com/KoharaKazuya/openapi-apigw-mock/blob/master/aws.js

    
V1.1
- [ ] Support non-mock integrations (type=HTTP_PROXY, httpMethod, uri vs existing mock code)
