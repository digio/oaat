/* eslint-disable @getify/proper-arrows/where */
const { compareResponseData, compareByType } = require('./compare');

describe('compareByType()', () => {
  it('should compare two objects and return true if the have the same shape AND type', () => {
    // Equal
    expect(compareByType({ objA: { a: '1' }, objB: { a: '1' } })).toEqual(true);
    expect(compareByType({ objA: { a: '1' }, objB: { a: '2' } })).toEqual(true);
    expect(compareByType({ objA: { a: { b: '2' } }, objB: { a: { b: 'xyz' } } })).toEqual(true);
    expect(compareByType({ objA: { a: [1, 2, 3] }, objB: { a: [1, 2, 3] } })).toEqual(true);
    expect(compareByType({ objA: { a: ['cat', 'bird'] }, objB: { a: ['fish', 'dog'] } })).toEqual(true);
    expect(compareByType({ objA: { a: [{ b: 'cat' }] }, objB: { a: [{ b: 'bird' }] } })).toEqual(true);
    expect(compareByType({ objA: { a: [{ b: ['cat'] }] }, objB: { a: [{ b: ['bird'] }] } })).toEqual(true);
    //
    // // Not equal
    const showDiff = false;
    expect(compareByType({ objA: { a: 1 }, objB: { a: '1' }, showDiff })).toEqual(false);
    expect(compareByType({ objA: { a: { b: '2' } }, objB: { a: {} }, showDiff })).toEqual(false);
    expect(compareByType({ objA: { a: [1, 2] }, objB: { a: [1, 2, 3] }, showDiff })).toEqual(false);
    expect(compareByType({ objA: { a: [{ b: 'cat' }] }, objB: { a: [{ b: 'bird', c: 1 }] }, showDiff })).toEqual(false);
    expect(compareByType({ objA: { a: [{ b: ['cat'] }] }, objB: { a: [{ b: ['cat', 'fish'] }] }, showDiff })).toEqual(false);
  });
});

describe('compareResponseData()', () => {
  it('should return an exact match when the contents of the response file and the API response are the same', () => {
    const responseFileData = { a: 'abc', b: { c: 123 } };
    const apiResponseObj = {
      response: { b: { c: 123 }, a: 'abc' },
    };

    const result = compareResponseData(responseFileData, apiResponseObj);
    expect(result).toEqual('exact');
  });

  it('should return an inexact match when the contents of the response file and the response are the same, except for an ignored property path', () => {
    const responseFileData = { a: 'abc', b: { c: 'random-key' } };
    const apiResponseObj = {
      response: { b: { c: 'another-random-key' }, a: 'abc' },
      apiEndpoint: {
        responses: {
          200: {
            'x-test-ignore-paths': ['b.c'],
          },
        },
      },
      statusCode: 200,
    };

    const result = compareResponseData(responseFileData, apiResponseObj);
    expect(result).toEqual('inexact');
  });

  it('should return a type match when the contents of the response file and the API response have the same type', () => {
    const responseFileData = { a: 'bar', b: { c: 1000 } };
    const apiResponseObj = {
      response: { b: { c: 123456 }, a: 'foo' },
      apiEndpoint: {
        responses: {
          200: {},
        },
      },
    };

    const result = compareResponseData(responseFileData, apiResponseObj);
    expect(result).toEqual('type');
  });

  it('should return no match when the contents of the response file and the response do not match', () => {
    const responseFileData = { a: 'abc', b: { c: 'random-key' }, d: 'extra prop' };
    const apiResponseObj = {
      response: { b: { c: 'another-random-key' }, a: 'XYZ' },
      apiEndpoint: {
        responses: {
          200: {
            'x-test-ignore-paths': ['b.c'],
          },
        },
      },
      statusCode: 200,
    };

    const result = compareResponseData(responseFileData, apiResponseObj);
    expect(result).toEqual('nomatch');
  });
});
