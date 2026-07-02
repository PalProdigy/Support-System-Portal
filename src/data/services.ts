import {
  Cloud, ShieldCheck, Network, ServerCog, ClipboardCheck,
  Lock, ShieldAlert, Server, LayoutGrid,
} from 'lucide-react'

export interface Service {
  slug: string
  title: string
  /** Short one-line summary shown on the card. */
  description: string
  /** Longer overview shown on the detail page. */
  overview: string
  /** Key capabilities listed on the detail page. */
  highlights: string[]
  icon: React.ComponentType<{ className?: string }>
}

/**
 * Services offered by NHQ Distributions Ltd.
 * Sourced from nhqbd.com.
 */
export const SERVICES: Service[] = [
  {
    slug: 'virtualization-cloud-solution',
    title: 'Virtualization & Cloud Solution',
    description: 'Design and deployment of virtualized and cloud infrastructure for scalable, resilient workloads.',
    overview:
      'We help organizations move beyond physical hardware limits with virtualization and cloud platforms that scale on demand. From server consolidation and virtual desktops to hybrid and public cloud migrations, we architect environments that improve utilization, cut costs, and keep critical workloads highly available.',
    highlights: [
      'Server and desktop virtualization (VMware, Hyper-V)',
      'Private, public, and hybrid cloud design',
      'Workload migration and consolidation',
      'High availability and disaster recovery',
    ],
    icon: Cloud,
  },
  {
    slug: 'endpoint-server-security',
    title: 'Endpoint & Server Security',
    description: 'Protect laptops, desktops, and servers against malware, ransomware, and advanced threats.',
    overview:
      'Endpoints and servers are the most targeted assets in any organization. We deploy next-generation endpoint protection, EDR, and server hardening to detect, block, and respond to threats across your entire fleet — on premises and remote.',
    highlights: [
      'Next-generation antivirus and EDR',
      'Ransomware and exploit prevention',
      'Server hardening and patch management',
      'Centralized policy and threat response',
    ],
    icon: ShieldCheck,
  },
  {
    slug: 'network-gateway-security',
    title: 'Network & Gateway Security',
    description: 'Secure your perimeter and internal traffic with firewalls, IPS, and secure web gateways.',
    overview:
      'We secure the network edge and the traffic that flows through it. Our gateway security combines next-generation firewalls, intrusion prevention, web and email filtering, and secure remote access to keep threats out and sensitive data in.',
    highlights: [
      'Next-generation firewall (NGFW) deployment',
      'Intrusion detection and prevention (IDS/IPS)',
      'Secure web and email gateways',
      'VPN and secure remote access',
    ],
    icon: Network,
  },
  {
    slug: 'data-center-security',
    title: 'Data Center Security',
    description: 'End-to-end protection for data center workloads, segmentation, and east-west traffic.',
    overview:
      'Modern data centers demand security that moves with the workload. We deliver micro-segmentation, workload protection, and visibility across virtual and physical data center infrastructure to contain threats and meet compliance requirements.',
    highlights: [
      'Micro-segmentation and zero-trust zoning',
      'East-west traffic inspection',
      'Workload and hypervisor protection',
      'Centralized monitoring and visibility',
    ],
    icon: ServerCog,
  },
  {
    slug: 'risk-compliance',
    title: 'Risk & Compliance',
    description: 'Assess risk and align your controls with regulatory and industry standards.',
    overview:
      'We help you understand where you stand and what it takes to get compliant. Our risk and compliance services map your environment against frameworks and regulations, identify gaps, and provide a clear remediation roadmap.',
    highlights: [
      'Risk assessment and gap analysis',
      'Policy and control framework alignment',
      'Regulatory and industry compliance (ISO, PCI, GDPR)',
      'Audit readiness and remediation planning',
    ],
    icon: ClipboardCheck,
  },
  {
    slug: 'data-protection',
    title: 'Data Protection',
    description: 'Safeguard sensitive data with encryption, DLP, and resilient backup and recovery.',
    overview:
      'Data is your most valuable asset. We protect it at rest, in motion, and in use through encryption, data loss prevention, and robust backup and recovery — so a breach, mistake, or outage never becomes a disaster.',
    highlights: [
      'Data loss prevention (DLP)',
      'Encryption and key management',
      'Backup, replication, and recovery',
      'Classification and access governance',
    ],
    icon: Lock,
  },
  {
    slug: 'vulnerability-assessment',
    title: 'Vulnerability Assessment',
    description: 'Identify, prioritize, and remediate weaknesses before attackers exploit them.',
    overview:
      'You cannot fix what you cannot see. Our vulnerability assessment and penetration testing services continuously scan your infrastructure and applications, prioritize findings by real-world risk, and guide remediation.',
    highlights: [
      'Network and application vulnerability scanning',
      'Penetration testing',
      'Risk-based prioritization',
      'Remediation guidance and re-testing',
    ],
    icon: ShieldAlert,
  },
  {
    slug: 'infrastructure',
    title: 'Infrastructure',
    description: 'Build and manage reliable compute, storage, and network infrastructure.',
    overview:
      'We design, deploy, and maintain the foundational infrastructure your business runs on. From servers and storage to networking and structured cabling, we deliver dependable, performant, and future-ready environments.',
    highlights: [
      'Server and storage solutions',
      'Networking and structured cabling',
      'Infrastructure monitoring and management',
      'Capacity planning and lifecycle support',
    ],
    icon: Server,
  },
  {
    slug: 'others',
    title: 'Others',
    description: 'Additional consulting, support, and tailored services for your unique needs.',
    overview:
      'Every organization is different. Beyond our core offerings, we provide tailored consulting, managed services, training, and support to address the specific challenges your business faces.',
    highlights: [
      'Security consulting and advisory',
      'Managed services and support',
      'Training and enablement',
      'Custom and tailored solutions',
    ],
    icon: LayoutGrid,
  },
]

export function getService(slug: string): Service | undefined {
  return SERVICES.find((s) => s.slug === slug)
}
