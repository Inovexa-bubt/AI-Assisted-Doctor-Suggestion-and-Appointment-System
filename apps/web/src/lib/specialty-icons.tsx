import {
  Baby,
  Bone,
  Brain,
  Droplet,
  Ear,
  Eye,
  Flower2,
  HeartPulse,
  type LucideIcon,
  Pill,
  Smile,
  Stethoscope,
  Sun,
  Wind,
  Droplets,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  medicine: Stethoscope,
  cardiology: HeartPulse,
  neurology: Brain,
  gastroenterology: Pill,
  orthopedics: Bone,
  gynecology: Flower2,
  pediatrics: Baby,
  ent: Ear,
  dermatology: Sun,
  respiratory: Wind,
  endocrinology: Droplet,
  ophthalmology: Eye,
  psychiatry: Smile,
  urology: Droplets,
}

export function SpecialtyIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? Stethoscope
  return <Icon className={className} aria-hidden />
}
