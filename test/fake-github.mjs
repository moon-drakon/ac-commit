// Small in-memory fake of the GitHub REST API: enough for whoAmI, Repo.load, and Repo.commit.
import { gitBlobSha } from '../src/github.js';

export function fakeGitHub({ files = { 'README.md': '# R\n' }, empty = false, conflictOnce = false } = {}) {
  const blobs = {};
  const trees = {};
  const commits = {};
  const state = { head: null, files: {}, commits: [], conflict: conflictOnce, calls: [] };
  let n = 0;

  const putTree = async (map) => {
    const id = `t${++n}`;
    trees[id] = { ...map };
    for (const content of Object.values(map)) blobs[await gitBlobSha(content)] = content;
    return id;
  };
  const setHead = (id) => {
    state.head = id;
    state.files = { ...trees[commits[id].tree] };
  };
  const ready = (async () => {
    if (empty) return;
    commits.c0 = { tree: await putTree(files) };
    setHead('c0');
  })();

  const res = (status, body) => ({ status, ok: status < 300, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

  const fetchImpl = async (url, init = {}) => {
    await ready;
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    state.calls.push(`${method} ${url}`);
    if (url === 'https://api.github.com/user') return res(200, { login: 'someone', id: 42, name: 'Some One' });
    const path = url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, '');
    if (method === 'GET' && path === '/git/ref/heads/main') {
      return state.head ? res(200, { object: { sha: state.head } }) : res(409, { message: 'Git Repository is empty.' });
    }
    if (method === 'PUT' && path === '/contents/README.md') {
      if (state.head) return res(422, { message: 'sha is required' });
      const content = new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)));
      commits.c0 = { tree: await putTree({ 'README.md': content }), message: body.message };
      setHead('c0');
      return res(201, { commit: { sha: 'c0' } });
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) return res(200, { tree: { sha: commits[path.split('/').pop()].tree } });
    if (method === 'GET' && path.startsWith('/git/trees/')) {
      const t = trees[path.split('/').pop().split('?')[0]];
      const tree = await Promise.all(Object.entries(t).map(async ([p, c]) => ({ path: p, type: 'blob', sha: await gitBlobSha(c) })));
      return res(200, { tree });
    }
    if (method === 'GET' && path.startsWith('/git/blobs/')) return res(200, blobs[path.split('/').pop()]);
    if (method === 'POST' && path === '/git/trees') {
      const map = { ...trees[body.base_tree] };
      for (const f of body.tree) {
        if (f.sha === null) delete map[f.path];
        else map[f.path] = f.content;
      }
      return res(201, { sha: await putTree(map) });
    }
    if (method === 'POST' && path === '/git/commits') {
      const id = `c${++n}`;
      commits[id] = { ...body };
      return res(201, { sha: id });
    }
    if (method === 'PATCH' && path === '/git/refs/heads/main') {
      if (state.conflict) {
        // Another browser pushed first: move the branch to a commit that adds a different file.
        state.conflict = false;
        const id = `c${++n}`;
        commits[id] = { tree: await putTree({ ...state.files, 'other.cpp': 'x\n' }) };
        setHead(id);
        return res(422, { message: 'Update is not a fast forward' });
      }
      setHead(body.sha);
      state.commits.push(commits[body.sha]);
      return res(200, {});
    }
    return res(404, { message: `unhandled ${method} ${path}` });
  };
  return { state, fetchImpl, ready };
}
