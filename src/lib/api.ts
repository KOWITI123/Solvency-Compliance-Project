import { Submission } from './types';
const API_BASE_URL = '/api';
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}
export const api = {
  getSubmissions: async (): Promise<Submission[]> => {
    const response = await fetch(`${API_BASE_URL}/submissions`);
    const data = await handleResponse<{ success: boolean, data: Submission[] }>(response);
    return data.data;
  },
  createSubmission: async (submissionData: { capital: number; liabilities: number; date: string }): Promise<Submission> => {
    const response = await fetch(`${API_BASE_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submissionData),
    });
    const data = await handleResponse<{ success: boolean, data: Submission }>(response);
    return data.data;
  },
};