TODO:

Commands:
- [-] amuck record 
  - [x] Do most things, including linking to linting task
  - [ ] Need a way to indicate that certain endpoints should not be recorded (status code > 1000?
- [x] amuck lint
  - [x] Add config file support, to customise linting
  - [x] Linting could add examples from x-examples into the parameters[].examples and requestBody.examples,
        with async values (vis script) being used
- [ ] amuck build
  - [...] Convert existing code to new style
  - [ ] Add support for customising web template (even using your own?)
  - [ ] Generate OpenAPI 3.0 spec compliant code (test that status > 1000 works)
- [ ] amuck deploy
  - To be implemented. Uses the script from https://github.com/KoharaKazuya/openapi-apigw-mock/blob/master/aws.js
- [ ] amuck compare
    
