const defaultHeaders = {
  'Content-Type': 'application/json'
};

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: defaultHeaders
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  return response.json();
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  return response.json();
}
