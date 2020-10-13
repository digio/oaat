function getShortEndpointName(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function getFullEndpointName(method, path, domain) {
  return `${method.toUpperCase()} ${domain}${path}`;
}

module.exports = {
  getShortEndpointName,
  getFullEndpointName,
};
