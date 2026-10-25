// Interactive architecture diagram: node selection and flow switching.
// Every "where" line names the repository and file where the behaviour exists today,
// or says plainly that it is planned.

const STATUS = {
  implemented: { label: 'Implemented', badge: 'badge--ok' },
  planned: { label: 'Planned, not built', badge: 'badge--planned' },
  support: { label: 'Supporting service · implemented', badge: 'badge--info' },
};

const NODES = {
  developer: {
    title: 'Developer',
    status: 'implemented',
    body: 'Work starts on a feature branch. Terraform changes stay small and reviewable, and nothing reaches main directly.',
    where: 'Both repositories · branch-and-PR workflow',
  },
  pr: {
    title: 'Pull request',
    status: 'implemented',
    body: 'main accepts changes only through a pull request with six required status checks. Review covers the plan output as well as the code diff.',
    where: 'ai-terraform-drift-detector · branch protection on main',
  },
  checks: {
    title: 'Validate & scan',
    status: 'implemented',
    body: 'terraform fmt -check and validate run offline, with no backend and no credentials. TFLint uses the azurerm ruleset. Trivy fails on HIGH or CRITICAL findings unless a risk acceptance with an expiry date covers them. TruffleHog scans the full Git history for secrets.',
    where: 'ai-terraform-drift-detector · terraform-auth-test.yml, security-scan.yml',
  },
  plan: {
    title: 'terraform plan',
    status: 'implemented',
    body: 'GitHub Actions signs in to Azure with OpenID Connect and runs terraform plan. The identity has no write permissions, so this step can show change but can\'t make it.',
    where: 'ai-terraform-drift-detector · terraform-auth-test.yml',
  },
  approval: {
    title: 'Approval gate',
    status: 'planned',
    body: 'The plan: apply waits on a GitHub environment where required reviewers approve the exact saved plan. This isn\'t built yet. The drift detector deliberately has no approval environment or write permission, and the landing zone currently applies on main without a gate.',
    where: 'Planned · drift-detector remediation spec and landing-zone roadmap',
  },
  apply: {
    title: 'Apply on the protected branch',
    status: 'implemented',
    body: 'Apply runs only for refs/heads/main. The job runs init, validate and plan again before applying, so feature branches can never change infrastructure.',
    where: 'Azure-Infra-Landing-Zone · .github/workflows/Terraform.yml (apply job)',
  },
  azure: {
    title: 'Azure resources',
    status: 'implemented',
    body: 'The drift detector\'s dev environment (resource group, VNet, subnet, NSG) was tested against real Azure changes. The landing zone defines modules for networking, Bastion, Key Vault, VMs, a load balancer and an application gateway.',
    where: 'drift detector · terraform/environments/dev · landing-zone modules/',
  },
  oidc: {
    title: 'Entra ID · OIDC federation',
    status: 'support',
    body: 'GitHub\'s OIDC token is exchanged for a short-lived Azure token through a federated credential. Trust is limited to the repository\'s main branch, only the Azure plan job may request a token, and no client secret exists.',
    where: 'ai-terraform-drift-detector · least-privilege audit (Task 12.3)',
  },
  state: {
    title: 'Remote state · Azure Storage',
    status: 'support',
    body: 'Terraform state lives in an Azure Storage container through the azurerm backend. Blob leases lock state during a run, so two pipelines can\'t write at once. A bootstrap step creates the storage itself.',
    where: 'Both repositories · terraform/bootstrap, backend configuration',
  },
  secrets: {
    title: 'Branch protection & supply chain',
    status: 'support',
    body: 'main is PR-only with required checks. Every workflow action is pinned by full commit SHA, checkouts don\'t keep credentials, and scanners run as pinned release binaries.',
    where: 'ai-terraform-drift-detector · Level 1 closeout hardening',
  },
  schedule: {
    title: 'Schedule',
    status: 'implemented',
    body: 'Detection runs daily at 02:00 UTC and on manual dispatch. One known watch item: GitHub pauses scheduled workflows after 60 days without repository activity.',
    where: 'ai-terraform-drift-detector · drift-detection.yml',
  },
  driftplan: {
    title: 'Plan evidence',
    status: 'implemented',
    body: 'The script runs init, plan -detailed-exitcode and show -json, and never apply. It writes an evidence bundle with a run manifest outside the repository. A failed run is reported as "unknown", never as "no drift".',
    where: 'ai-terraform-drift-detector · scripts/generate_plan_json.sh',
  },
  engine: {
    title: 'Drift engine',
    status: 'implemented',
    body: 'An integrity gate re-checks the evidence first. The engine then classifies each managed resource (external drift, external deletion, configuration change, added, removed, mixed or undetermined) with recorded, real and desired values per attribute. Sensitive values are redacted.',
    where: 'ai-terraform-drift-detector · src/drift_engine/',
  },
  investigate: {
    title: 'Investigate',
    status: 'implemented',
    body: 'Drift is matched against Azure Activity Log entries to answer who, when and what. When logs are missing it reports "unknown" instead of guessing. This was proven end to end on real Azure.',
    where: 'ai-terraform-drift-detector · drift-engine investigate (Phase 9B)',
  },
  outputs: {
    title: 'Issues, AI report & cost',
    status: 'implemented',
    body: 'Each drifted resource gets one structure-only GitHub Issue, closed only on evidence. CI also produces a no-LLM AI analysis report, an Infracost estimate of the plan, and list-price estimates for resources Terraform doesn\'t manage.',
    where: 'ai-terraform-drift-detector · drift-detection.yml, ai-analysis.yml',
  },
  remediate: {
    title: 'Human-approved remediation',
    status: 'planned',
    body: 'Specified but not built. A human chooses the remediation direction, with no auto-merge and no apply triggered by a merge. It has moved to the Level 2 backlog.',
    where: 'Planned · docs/remediation-safeguards.md',
  },
};

const DEFAULT_NODE = { delivery: 'plan', drift: 'engine' };

export function initArchitecture() {
  const root = document.getElementById('architecture');
  if (!root) return;

  const detail = root.querySelector('[data-arch-detail]');
  const title = detail.querySelector('[data-arch-title]');
  const body = detail.querySelector('[data-arch-body]');
  const where = detail.querySelector('[data-arch-where]');
  const badge = detail.querySelector('[data-arch-status]');
  const nodes = [...root.querySelectorAll('[data-node]')];
  const views = [...root.querySelectorAll('[data-arch-view]')];
  const home = detail.parentElement;
  const phone = window.matchMedia('(max-width: 719.98px)');
  let selectedId = DEFAULT_NODE.delivery;

  // On phones, show the explanation directly under the selected node instead of
  // at the end of a long vertical diagram.
  function place() {
    const node = nodes.find((n) => n.dataset.node === selectedId);
    if (phone.matches && node) node.parentElement.append(detail);
    else if (detail.parentElement !== home) home.append(detail);
  }

  function select(id) {
    const data = NODES[id];
    if (!data) return;
    selectedId = id;
    for (const node of nodes) node.setAttribute('aria-pressed', String(node.dataset.node === id));
    const status = STATUS[data.status];
    badge.className = `badge ${status.badge}`;
    badge.textContent = status.label;
    title.textContent = data.title;
    body.textContent = data.body;
    where.textContent = data.where;
    place();
  }

  for (const node of nodes) {
    node.addEventListener('click', () => select(node.dataset.node));
  }

  for (const button of views) {
    button.addEventListener('click', () => {
      const view = button.dataset.archView;
      for (const b of views) b.setAttribute('aria-pressed', String(b === button));
      for (const diagram of root.querySelectorAll('[data-diagram]')) {
        diagram.hidden = diagram.dataset.diagram !== view;
      }
      select(DEFAULT_NODE[view]);
    });
  }

  phone.addEventListener('change', place);
  select(DEFAULT_NODE.delivery);
}
