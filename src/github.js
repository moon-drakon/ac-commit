// Small GitHub client built on the Git Data API.
// Each AC is one commit that writes the code file and updates README.md together.
// The branch update uses force: false, so two browsers syncing at once cannot overwrite each other.
const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message) {
    super(`GitHub ${status}: ${message}`);
    this.status = status;
  }
}

async function call(fetchImpl, token, method, url, body, accept = 'application/vnd.github+json') {
  const res = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch {}
    throw new GitHubError(res.status, msg);
  }
  if (accept.includes('raw')) return text;
  return text ? JSON.parse(text) : null;
}

// The account that owns the token, and the noreply email that links commits to it.
export async function whoAmI(token, fetchImpl = fetch) {
  const u = await call(fetchImpl, token, 'GET', `${API}/user`);
  return { login: u.login, name: u.name || u.login, email: `${u.id}+${u.login}@users.noreply.github.com` };
}

// Git's blob id for a text file, so we can tell if the repo already has this exact code.
export async function gitBlobSha(text) {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const buf = new Uint8Array(head.length + body.length);
  buf.set(head);
  buf.set(body, head.length);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const b64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export class Repo {
  constructor({ token, owner, repo, branch = 'main', fetchImpl = fetch }) {
    Object.assign(this, { token, owner, repo, branch, fetchImpl });
    this.loaded = false;
  }

  api(method, path, body, accept) {
    return call(this.fetchImpl, this.token, method, `${API}/repos/${this.owner}/${this.repo}${path}`, body, accept);
  }

  // Reads the branch head, every file with its blob id, and README.md.
  // An empty repo gets `initialReadme` as its first commit, when one is given.
  async load({ initialReadme } = {}) {
    let ref;
    try {
      ref = await this.api('GET', `/git/ref/heads/${this.branch}`);
    } catch (err) {
      if ((err.status === 404 || err.status === 409) && initialReadme) {
        await this.api('PUT', '/contents/README.md', { message: 'Add README', content: b64(initialReadme), branch: this.branch });
        return this.load();
      }
      if (err.status === 404 || err.status === 409) {
        throw new GitHubError(err.status, `${this.owner}/${this.repo} has no "${this.branch}" branch, or the token cannot see the repo.`);
      }
      throw err;
    }
    this.head = ref.object.sha;
    const commit = await this.api('GET', `/git/commits/${this.head}`);
    this.treeSha = commit.tree.sha;
    const tree = await this.api('GET', `/git/trees/${this.treeSha}?recursive=1`);
    this.blobs = new Map(tree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.sha]));
    this.paths = new Set(this.blobs.keys());
    const readme = this.blobs.get('README.md');
    this.readme = readme ? await this.api('GET', `/git/blobs/${readme}`, null, 'application/vnd.github.raw+json') : '';
    this.loaded = true;
    return this;
  }

  // build(repo) returns { files: [{ path, content } | { path, delete: true }], message } or null to skip.
  // It runs again after a conflict, so it must read state from `repo`, not from a closure.
  async commit(build, { name, email, date }) {
    if (!this.loaded) await this.load();
    for (let attempt = 0; attempt < 4; attempt++) {
      const plan = await build(this);
      if (!plan) return null;
      const tree = await this.api('POST', '/git/trees', {
        base_tree: this.treeSha,
        tree: plan.files.map((f) => (f.delete
          ? { path: f.path, mode: '100644', type: 'blob', sha: null }
          : { path: f.path, mode: '100644', type: 'blob', content: f.content })),
      });
      const who = { name, email, date: date || new Date().toISOString() };
      const commit = await this.api('POST', '/git/commits', {
        message: plan.message,
        tree: tree.sha,
        parents: [this.head],
        author: who,
        committer: who,
      });
      try {
        await this.api('PATCH', `/git/refs/heads/${this.branch}`, { sha: commit.sha, force: false });
      } catch (err) {
        // 422 means the branch moved since load(). Reload and rebuild on top of the new head.
        if (err.status === 422) { await this.load(); continue; }
        throw err;
      }
      this.head = commit.sha;
      this.treeSha = tree.sha;
      for (const f of plan.files) {
        if (f.delete) {
          this.paths.delete(f.path);
          this.blobs.delete(f.path);
          continue;
        }
        this.paths.add(f.path);
        this.blobs.set(f.path, await gitBlobSha(f.content));
        if (f.path === 'README.md') this.readme = f.content;
      }
      return commit.sha;
    }
    throw new Error('Branch kept moving during the push. Try again.');
  }
}
