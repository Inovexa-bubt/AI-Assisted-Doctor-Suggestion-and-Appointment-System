
export type Setting = {
  key: string;
  value: string;
  description: string;
};

export const settings: Setting[] = [
  {
    key: "online_booking_cutoff_minutes",
    value: "60",
    description: "Minimum minutes before a session when online booking closes."
  },
  {
    key: "hold_duration_minutes",
    value: "5",
    description: "How long an appointment slot remains held."
  },
  {
    key: "hospital_name",
    value: "Lumina Specialized Hospital",
    description: "Hospital display name."
  }
];

export function getAllSettings(): Setting[] {
  return [...settings];
}

export function findSetting(key: string): Setting | undefined {
  return settings.find(setting => setting.key === key);
}

export function updateSetting(
  key: string,
  value: string
): Setting | null {
  const setting = findSetting(key);

  if (!setting) {
    return null;
  }

  setting.value = value;

  return setting;
}
