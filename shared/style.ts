export interface TeamStyle {
  name: string;
  color: string;
  deep: string;
  soft: string;
}

export const TEAM_STYLES: TeamStyle[] = [
  { name: 'Hot Sauce', color: '#FF4D2E', deep: '#B8290F', soft: '#FFD9CF' },
  { name: 'Lagoon', color: '#00B8A9', deep: '#007A70', soft: '#C7F2EE' },
  { name: 'Banana', color: '#FFC22E', deep: '#B88200', soft: '#FFF0C2' },
  { name: 'Cobalt', color: '#3A5BFF', deep: '#1E36B8', soft: '#D6DDFF' },
];

export const REACTIONS = ['😂', '🔥', '😱', '👏', '🤦', '💀'];

export const AVATAR_COUNT = 24;
