// Pipeline explorer: an illustrative, clearly labelled walk through Terraform CI stages.
// Output lines are examples written for this page — they are not fetched from real CI runs.

const PIPELINES = {
  pr: [
    {
      id: 'fmt', name: 'fmt', tag: 'style',
      title: 'terraform fmt',
      cmd: 'terraform fmt -check -recursive',
      purpose: 'Checks that every .tf file uses canonical formatting, so reviews show real changes instead of whitespace noise.',
      fails: 'Any file would be rewritten by terraform fmt.',
      why: 'Diffs stay readable, and formatting arguments never reach code review.',
      output: [['o-cmd', '$ terraform fmt -check -recursive'], ['o-dim', '(no output: all files formatted)'], ['o-add', 'exit 0']],
    },
    {
      id: 'init', name: 'init', tag: 'offline',
      title: 'terraform init -backend=false',
      cmd: 'terraform init -backend=false',
      purpose: 'Installs providers from the lock file without touching remote state. Validation needs no Azure access at all.',
      fails: 'A provider version conflicts with .terraform.lock.hcl or can\'t be downloaded.',
      why: 'Static checks run on every fork and PR without credentials.',
      output: [['o-cmd', '$ terraform init -backend=false'], ['', 'Initializing provider plugins...'], ['', '- Reusing previous version of hashicorp/azurerm from the dependency lock file'], ['o-add', 'Terraform has been successfully initialized!']],
    },
    {
      id: 'validate', name: 'validate', tag: 'syntax',
      title: 'terraform validate',
      cmd: 'terraform validate',
      purpose: 'Checks that the configuration is internally consistent: references resolve, types match and required arguments are set.',
      fails: 'An undeclared variable, a wrong attribute type or a missing required argument.',
      why: 'Catches broken modules in seconds, before a plan ever talks to Azure.',
      output: [['o-cmd', '$ terraform validate'], ['o-add', 'Success! The configuration is valid.']],
    },
    {
      id: 'tflint', name: 'tflint', tag: 'lint',
      title: 'TFLint + azurerm ruleset',
      cmd: 'tflint --recursive',
      purpose: 'Lints for provider-aware mistakes that validate can\'t see: invalid VM sizes, deprecated syntax, unused declarations, naming rules.',
      fails: 'Any rule violation at error level.',
      why: 'Finds mistakes that would only show up when apply fails in Azure.',
      output: [['o-cmd', '$ tflint --recursive'], ['o-dim', 'tflint-ruleset-azurerm enabled'], ['o-add', '0 issue(s) found']],
    },
    {
      id: 'trivy', name: 'trivy', tag: 'security',
      title: 'Trivy config scan',
      cmd: 'trivy config --severity HIGH,CRITICAL terraform/',
      purpose: 'Scans Terraform for insecure configuration, such as storage open to the public, missing network restrictions or weak TLS.',
      fails: 'A HIGH or CRITICAL finding with no recorded risk acceptance and expiry date.',
      why: 'Security review happens on every change instead of once a quarter.',
      output: [['o-cmd', '$ trivy config --severity HIGH,CRITICAL terraform/'], ['', 'Tests: 112 (SUCCESSES: 111, FAILURES: 1)'], ['o-chg', 'AZU-0012  HIGH  storage network rules allow access by default'], ['o-dim', '→ covered by risk acceptance (expires 2027-03-31)'], ['o-add', 'exit 0']],
    },
    {
      id: 'secrets', name: 'secrets', tag: 'security',
      title: 'TruffleHog secret scan',
      cmd: 'trufflehog git file://. --fail',
      purpose: 'Searches the full Git history, not just the latest commit, for credentials such as keys, tokens and connection strings.',
      fails: 'A verified or unverified secret is found anywhere in history.',
      why: 'A secret deleted in a later commit is still leaked. This finds it.',
      output: [['o-cmd', '$ trufflehog git file://. --fail'], ['o-dim', 'scanning 412 commits...'], ['o-add', 'found 0 verified, 0 unverified secrets']],
    },
    {
      id: 'plan', name: 'plan', tag: 'oidc',
      title: 'terraform plan',
      cmd: 'terraform plan -detailed-exitcode -out=tfplan',
      purpose: 'Signs in with OIDC (no stored secret) and computes the exact changes. The saved plan is what gets reviewed.',
      fails: 'Authentication or provider errors (exit 1). Exit 2 means changes are pending, which is not a failure.',
      why: 'Reviewers approve what will actually happen, not what the code suggests.',
      output: [['o-cmd', '$ terraform plan -detailed-exitcode -out=tfplan'], ['', '  # azurerm_network_security_group.app will be updated in-place'], ['o-chg', '  ~ security_rule { ... }'], ['', '  # azurerm_subnet.app will be created'], ['o-add', '  + address_prefixes = ["10.10.2.0/24"]'], ['', 'Plan: 1 to add, 1 to change, 0 to destroy.'], ['o-dim', 'exit 2 → changes pending']],
    },
    {
      id: 'approval', name: 'approve', tag: 'planned', gate: true,
      title: 'Approval gate (planned)',
      cmd: 'environment: production · required reviewers',
      purpose: 'A person approves the saved plan before apply. This is the intended design and isn\'t built in my repositories yet.',
      fails: 'A reviewer rejects the change, or the approval window expires.',
      why: 'Production changes get a deliberate human decision tied to an exact plan.',
      output: [['o-dim', 'Waiting for review: production needs 1 approval'], ['o-dim', '(illustrative: no approval environment exists yet)']],
    },
    {
      id: 'apply', name: 'apply', tag: 'main only',
      title: 'terraform apply',
      cmd: 'terraform apply tfplan',
      purpose: 'Applies exactly the saved plan, and only from the protected main branch.',
      fails: 'Azure rejects a change partway through. State keeps a record of what succeeded.',
      why: 'Only reviewed changes reach Azure, with no direct-push path.',
      output: [['o-cmd', '$ terraform apply tfplan'], ['', 'azurerm_subnet.app: Creating...'], ['o-add', 'azurerm_subnet.app: Creation complete after 6s'], ['', 'Apply complete! Resources: 1 added, 1 changed, 0 destroyed.']],
    },
  ],
  drift: [
    {
      id: 'preflight', name: 'preflight', tag: 'guard',
      title: 'Preflight',
      cmd: 'resolve environment · check inputs',
      purpose: 'Works out which environment to check and refuses to continue on missing or unexpected inputs.',
      fails: 'An unknown environment or missing configuration.',
      why: 'A misconfigured run stops early instead of producing a misleading report.',
      output: [['o-dim', 'trigger: schedule (0 2 * * *)'], ['', 'environment: dev'], ['o-add', 'preflight ok']],
    },
    {
      id: 'login', name: 'oidc login', tag: 'oidc',
      title: 'Azure login with OIDC',
      cmd: 'azure/login (federated credential)',
      purpose: 'Exchanges GitHub\'s OIDC token for a short-lived Azure token. Only this job may request one.',
      fails: 'The federated credential subject doesn\'t match (e.g. wrong branch).',
      why: 'No long-lived secret exists that could leak.',
      output: [['', 'Federated token exchanged for Azure access token'], ['o-dim', 'subject: repo:<owner>/<repo>:ref:refs/heads/main'], ['o-add', 'Login successful (reader roles only)']],
    },
    {
      id: 'evidence', name: 'plan evidence', tag: 'read-only',
      title: 'Plan evidence',
      cmd: './scripts/generate_plan_json.sh',
      purpose: 'Runs init, plan -detailed-exitcode and show -json, never apply, and writes a manifest-backed evidence bundle.',
      fails: 'plan exits 1, or the evidence can\'t be written. The run is then reported as "unknown".',
      why: 'Drift decisions are based on verifiable evidence, not on log scraping.',
      output: [['o-cmd', '$ ./scripts/generate_plan_json.sh'], ['', 'terraform plan exit 2 (pending changes; classification decides drift)'], ['o-add', 'evidence: detection_run.json · plan.log · plan.json']],
    },
    {
      id: 'classify', name: 'classify', tag: 'engine',
      title: 'Drift engine',
      cmd: 'drift-engine analyze --plan plan.json --format console',
      purpose: 'Re-checks evidence integrity, then classifies every managed resource and rates severity with rules.',
      fails: 'The integrity gate rejects the evidence bundle.',
      why: 'A deterministic result that AI analysis may explain but never change.',
      output: [['o-cmd', '$ drift-engine analyze --plan plan.json --format console'], ['', 'azurerm_resource_group.main'], ['o-chg', '  external drift · tags.owner  recorded="platform" real="manual-edit"'], ['o-dim', '  severity: low · sensitive values redacted'], ['', 'drift_detected: true (1 resource)']],
    },
    {
      id: 'investigate', name: 'investigate', tag: 'who/when',
      title: 'Activity Log investigation',
      cmd: 'drift-engine investigate',
      purpose: 'Matches drift with Azure Activity Log entries to answer who changed what, and when.',
      fails: 'It doesn\'t fail on missing logs. It reports "unknown" instead of guessing.',
      why: 'Turns "something changed" into a conversation with the right person.',
      output: [['o-cmd', '$ drift-engine investigate'], ['', 'Microsoft.Resources/tags/write'], ['o-dim', '  caller: <withheld in public report> · 2026-10-11T09:14Z'], ['o-add', '  attribution: sole capable operation']],
    },
    {
      id: 'issues', name: 'issues', tag: 'github',
      title: 'GitHub Issues',
      cmd: 'scripts/github_automation.py',
      purpose: 'Opens one structure-only issue per drifted resource and closes it only when evidence shows it\'s back in sync.',
      fails: 'The GitHub API is unavailable. Drift results are kept and the step is retried on the next run.',
      why: 'Drift becomes tracked work with an owner, not a log line.',
      output: [['o-add', 'opened issue: drift · azurerm_resource_group.main (tags)'], ['o-dim', 'issue body contains structure only: no values, no identifiers']],
    },
    {
      id: 'cost', name: 'cost', tag: 'finops',
      title: 'Cost analysis',
      cmd: 'infracost breakdown · unmanaged inventory',
      purpose: 'Prices the run\'s plan with Infracost and lists Azure resources Terraform doesn\'t manage, with list-price estimates.',
      fails: 'A cost failure turns the run red but never changes the drift result.',
      why: 'Drift and shadow resources come with a price tag attached.',
      output: [['o-cmd', '$ infracost breakdown --path plan.json'], ['', 'monthly cost change: $0.00 (tags only)'], ['o-chg', 'unmanaged resources in rg: 0']],
    },
  ],
};

export function initPipelineExplorer() {
  const root = document.querySelector('[data-explorer]');
  if (!root) return;

  const list = root.querySelector('[data-stage-list]');
  const panel = root.querySelector('[data-stage-panel]');
  const els = {
    title: panel.querySelector('[data-stage-title]'),
    badge: panel.querySelector('[data-stage-badge]'),
    purpose: panel.querySelector('[data-stage-purpose]'),
    fails: panel.querySelector('[data-stage-fails]'),
    why: panel.querySelector('[data-stage-why]'),
    cmd: panel.querySelector('[data-stage-cmd]'),
    output: panel.querySelector('[data-stage-output]'),
  };
  const playButton = root.querySelector('[data-explorer-play]');
  const playLabel = root.querySelector('[data-explorer-play-label]');
  const switches = [...root.querySelectorAll('[data-pipeline]')];

  let current = 'pr';
  let selected = 0;
  let states = [];
  let timer = null;

  function stages() {
    return PIPELINES[current];
  }

  function defaultState(stage) {
    return stage.gate ? 'gate' : 'passed';
  }

  function render() {
    list.replaceChildren();
    stages().forEach((stage, index) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'presentation');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'stage';
      button.id = `stage-tab-${current}-${stage.id}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'stage-panel');
      button.dataset.index = String(index);

      const icon = document.createElement('span');
      icon.className = 'stage__icon';
      icon.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'stage__name';
      name.textContent = stage.name;
      const tag = document.createElement('span');
      tag.className = 'stage__tag';
      tag.textContent = stage.tag;

      button.append(icon, name, tag);
      button.addEventListener('click', () => {
        stop();
        select(index, false);
      });
      li.append(button);
      list.append(li);
    });
    paintStates();
    select(selected, false);
  }

  function paintStates() {
    [...list.querySelectorAll('.stage')].forEach((button, index) => {
      const state = states[index];
      button.dataset.state = state;
      const icon = button.querySelector('.stage__icon');
      icon.textContent = { passed: '✓', running: '●', gate: '◇', queued: String(index + 1) }[state] ?? String(index + 1);
    });
  }

  function select(index, focus) {
    selected = index;
    const stage = stages()[index];
    const buttons = [...list.querySelectorAll('.stage')];
    buttons.forEach((button, i) => {
      const on = i === index;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    const active = buttons[index];
    panel.setAttribute('aria-labelledby', active.id);
    if (focus) active.focus({ preventScroll: true });
    // Keep the active stage visible in the horizontally scrolling list (tablet/phone)
    // without scrolling the page itself.
    if (list.scrollWidth > list.clientWidth) {
      const li = active.parentElement;
      list.scrollLeft = li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2;
    }

    const state = states[index];
    els.title.textContent = stage.title;
    els.badge.className = `badge ${badgeClass(state)}`;
    els.badge.textContent = badgeText(state, stage);
    els.purpose.textContent = stage.purpose;
    els.fails.textContent = stage.fails;
    els.why.textContent = stage.why;
    els.cmd.textContent = `$ ${stage.cmd}`;
    els.output.replaceChildren(
      ...stage.output.map(([cls, text]) => {
        const line = document.createElement('span');
        if (cls) line.className = cls;
        line.textContent = `${text}\n`;
        return line;
      }),
    );
  }

  function badgeClass(state) {
    return { passed: 'badge--ok', running: 'badge--info', gate: 'badge--planned', queued: 'badge--muted' }[state] ?? '';
  }

  function badgeText(state, stage) {
    if (state === 'gate') return 'planned · waits for approval';
    if (state === 'running') return 'running (simulated)';
    if (state === 'queued') return 'queued';
    return stage.gate ? 'planned' : 'example: passed';
  }

  function reset(toDefault) {
    states = stages().map((stage) => (toDefault ? defaultState(stage) : 'queued'));
  }

  function stop() {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (states.some((s) => s === 'running' || s === 'queued')) {
      reset(true);
      paintStates();
    }
    playLabel.textContent = 'Simulate run';
    playButton.setAttribute('aria-pressed', 'false');
  }

  function play() {
    reset(false);
    paintStates();
    playLabel.textContent = 'Stop simulation';
    playButton.setAttribute('aria-pressed', 'true');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = reduce ? 450 : 750;
    let i = 0;

    const tick = () => {
      if (i > 0) states[i - 1] = 'passed';
      if (i >= stages().length) {
        timer = null;
        paintStates();
        select(stages().length - 1, false);
        playLabel.textContent = 'Simulate again';
        playButton.setAttribute('aria-pressed', 'false');
        return;
      }
      const stage = stages()[i];
      if (stage.gate) {
        states[i] = 'gate';
        paintStates();
        select(i, false);
        timer = null;
        playLabel.textContent = 'Simulate again';
        playButton.setAttribute('aria-pressed', 'false');
        // Remaining stages stay queued: the run waits here, as it would for a human reviewer.
        return;
      }
      states[i] = 'running';
      paintStates();
      select(i, false);
      i += 1;
      timer = window.setTimeout(tick, step);
    };
    tick();
  }

  playButton.addEventListener('click', () => {
    if (timer) stop();
    else play();
  });

  list.addEventListener('keydown', (event) => {
    const count = stages().length;
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next = null;
    if (event.key in keys) next = (selected + keys[event.key] + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    if (next === null) return;
    event.preventDefault();
    stop();
    select(next, true);
  });

  for (const button of switches) {
    button.addEventListener('click', () => {
      stop();
      current = button.dataset.pipeline;
      for (const b of switches) b.setAttribute('aria-pressed', String(b === button));
      selected = 0;
      reset(true);
      render();
    });
  }

  reset(true);
  render();
}
