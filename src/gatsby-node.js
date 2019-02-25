"use strict";

const axios = require(`axios`);
const crypto = require('crypto');

const prefix = `])}while(1);</x>`;

const stripPayloadPrefix = payload => payload.replace(prefix, ``);

const fetch = (username, limit = 100) => {
  const url = `https://medium.com/${username}/latest?format=json&limit=${limit}`;
  console.log(`fetching: ${url}`);
  return axios.get(url);
};

exports.sourceNodes = async ({
  actions,
  createNodeId,
  createContentDigest
}, {
  usernames,
  limit
}) => {
  const {
    createNode
  } = actions;

  // extract and concatenate data from users
  const resources = usernames.reduce(async (previousPromise, username) => {
    const result = await fetch(username, limit);
    const json = JSON.parse(stripPayloadPrefix(result.data));
    const postsNode = json.payload.references.Post;
    const usersNode = json.payload.references.User;

    const accumulator = await previousPromise;

    const postsNodeArray = Object.values(postsNode);
    const usersNodeArray = Object.values(usersNode);

    // add author info to posts
    const postsNodeArrayWithAuthor = postsNodeArray.map(post => {
      return {
        ...post,
        author: usersNode[post.creatorId]
      };
    });

    // concat with previous values
    return {
      Post: {
        ...accumulator.Post,
        nodes: accumulator.Post.nodes.concat(postsNodeArrayWithAuthor),
      },
      User: {
        ...accumulator.User,
        nodes:  accumulator.User.nodes.concat(usersNodeArray),
      }
    };
  }, {
    Post: {
      id: 'id',
      name: 'Post',
      nodes: []
    },
    User: {
      id: 'userId',
      name: 'User',
      nodes: []
    },
  });

  const nodeResources = await resources;
  const nodeResourcesMapping = Object.values(nodeResources);

  nodeResourcesMapping.forEach(resource => {
    const { name, id, nodes } = resource;
    // create node
    nodes.forEach(node => {
      createNode({
        ...node,
        id: createNodeId(`medium-${name.toLowerCase()}-${node[id]}`),
        parent: null,
        children: [],
        internal: {
          type: `Medium${name}`,
          content: JSON.stringify(node),
          contentDigest: crypto
              .createHash('md5')
              .update(JSON.stringify(node))
              .digest('hex')
        }
      });
    });
  });
};
