import { apiGet } from './api';

export interface Team {
  id: string;
  name: string;
}

export async function fetchTeams(): Promise<Team[]> {
  const { teams } = await apiGet<{ teams: Team[] }>('/teams');
  return teams;
}
