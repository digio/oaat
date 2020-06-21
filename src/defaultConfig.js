module.exports = {
  record: {
    responseBasePath: 'responses/', // Allows the responses to be removed, if the only files in this directory are mock files
    removeUnusedResponses: true,
    responseFilenameFn(apiData) {
      const exampleName =
        apiData.exampleIndex === 0
          ? `DEFAULT${apiData.exampleName === 'default' ? '' : `_${apiData.exampleName}`}`
          : apiData.exampleName;
      return `${apiData.config.method.toUpperCase()}_${apiData.path.slice(1).replace(/\//g, '_')}-${
        apiData.statusCode
      }_${exampleName}.json`;
    },
    updateResponseWhenInexactMatch: true,
    updateResponseWhenTypesMatch: true,
    andLint: true,
  },
  lint: {
    sortPathsAlphabetically: true,
    sortComponentsAlphabetically: true,
    syncExamples: true,
  },
  build: {
    specUIEndpoint: '/',
    specFileEndpoint: '/open-api-spec.json',
    webTitle: 'My Company',
    webLogoUrl: 'https://www.elitedangerous.com/img/logo-elite-dangerous-icon.c7206b1e.svg',
    webFaviconHref:
      'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAAAAAAAAAAAAAAAAAAAC0/9wAtP/cHLT/3SS0/96ktP/flLT/3/C0/9/wtP/flLT/3qS0/90ktP/cHLT/3AAAAAAAAAAAALT/3AC0/9wAtP/cZLT/3ky0/9+8tP/f/LT/3/y0/9/8tP/f/LT/3/y0/9/8tP/fvLT/3ky0/9xktP/cALT/3AC0/9wAtP/cZLT/3sS5A9/8tP/f/LT/3/y0/9/8tP/f/LT/3/y0/9/8tP/f/LT/3/y0/9/8tP/exLT/3GS0/9wAtP/cGLT/3kys+9/9GVvj/TVz4/ys99/8tP/f/LT/3/y0/9/8tP/f/LT/3/y0/9/8tP/f/LT/3/y0/95MtP/cGLT/3Si0/9+4rPff/TVz4/56m+/80Rff/Kjz3/zJE9/8vQPf/LT/3/y0/9/8tP/f/LT/3/y0/9/8tP/fuLT/3Si0/96gtP/f/LD73/zpK9//Kz/3/hpD6/2Rx+f+6wPz/aHX5/yo89/8tP/f/LT/3/y0/9/8tP/f/LT/3/y0/96gtP/fkLT/3/y0/9/8sPvf/pKz8//b3///z9P///////8nO/f88TPj/Kz33/zJE9/8xQvf/LT/3/y0/9/8tP/fkLT/3+y0/9/8tP/f/Kj33/2Fu+f/x8v7/7O7+//j5///9/v//lp/7/zhJ9/+Yofv/VWP5/ys99/8tP/f/LT/3+y0/9/stP/f/LT/3/y0/9/8yRPf/bHn5/1Ni+P+yufz///////Hy/v/Eyf3/8fL+/2Rx+f8qPPf/LT/3/y0/9/stP/fkLT/3/y0/9/8tP/f/LT/3/yo89/8pO/f/Sln4/9ve/v////////////z8//9ve/r/KTz3/y0/9/8tP/fkLT/3qC0/9/8tP/f/LT/3/y0/9/8sPvf/NUb3/4iS+v/p6/7/////////////////e4f6/yk89/8tP/f/LT/3qC0/90otP/fuLT/3/y0/9/8tP/f/LT/3/zRF9/97hvr/w8j9/+3u/v/9/v///////4mT+v8qPPf/LT/37i0/90otP/cGLT/3ky0/9/8tP/f/LT/3/y0/9/8tP/f/Kjz3/zNF9/9SYPj/fIj6/6au/P9tevn/Kz33/y0/95MtP/cGLT/3AC0/9xktP/exLT/3/y0/9/8tP/f/LT/3/y0/9/8tP/f/Kz33/yo89/8sPvf/LT/3/y0/97EtP/cZLT/3AC0/9wAtP/cALT/3GS0/95MtP/fvLT/3/y0/9/8tP/f/LT/3/y0/9/8tP/f/LT/37y0/95MtP/cZLT/3AC0/9wAAAAAAAAAAAC0/9wAtP/cHLT/3SS0/96ktP/flLT/3/C0/9/wtP/flLT/3qS0/90ktP/cHLT/3AAAAAAAAAAAA4AcAAMADAACAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIABAADAAwAA4AcAAA==',
  },
};
