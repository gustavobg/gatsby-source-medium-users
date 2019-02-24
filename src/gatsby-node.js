const axios = require(`axios`);
const crypto = require('crypto');

const prefix = `])}while(1);</x>`;

const stripPayloadPrefix = payload => payload.replace(prefix, ``);

const fetch = (username, limit = 100) => {
  const url = `https://medium.com/${username}/latest?format=json&limit=${limit}`;
  console.log(`fetching: ${url}`);
  return axios.get(url);
};

exports.sourceNodes = async (
  { actions, createNodeId, createContentDigest },
  { usernames, limit }
) => {

  const { createNode } = actions;

  // accumulate data from users
  const resources = usernames.reduce(async(accumulator, username) => {
    const result = await fetch(username, limit);
    const json = JSON.parse(stripPayloadPrefix(result.data));
    const postsNode = json.payload.references.Post;
    const userNode = json.payload.references.User;
    const previousPromise = await accumulator;
    return {
        Posts: previousPromise.Posts.concat(Object.values(postsNode)),
        Users: previousPromise.Users.concat(Object.values(userNode))
    };
  }, [
      { Posts: [], },
      { Users: [], }
  ]);

  // create node
  const nodeResources = await resources;
  const nodeResourcesMapping = Object.entries(nodeResources);

  nodeResourcesMapping.forEach((resource) => {
      const resourceName = resource[0];
      const resourceData = resource[1];

      resourceData.forEach(node => {
         createNode({
          ...node,
          id: createNodeId(`medium-${resourceName.toLowerCase()}-${node.id}`),
          parent: null,
          children: [],
          internal: {
            type: `Medium${resourceName}`,
            content: JSON.stringify(node),
            contentDigest: crypto
              .createHash('md5')
              .update(JSON.stringify(node))
              .digest('hex')
          }
        });
      })
  });
};
