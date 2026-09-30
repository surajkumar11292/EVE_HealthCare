/**
 * EVE Healthcare — API Service Client
 * Configured with request correlation ID, JWT auth token injection, and typed endpoints.
 */

// Generate random UUIDv4 for request tracing
function generateRequestId() {
  return 'req-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

class ApiService {
  constructor() {
    this.token = localStorage.getItem('eve_auth_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('eve_auth_token', token);
    } else {
      localStorage.removeItem('eve_auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(path, options = {}) {
    const url = path.startsWith('/') ? path : `/${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Request-ID': generateRequestId(),
      ...(options.headers || {}),
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const error = new Error(
          data?.detail || data?.error?.message || `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        err.status = 0;
      }
      throw err;
    }
  }

  // System & Telemetry
  async getHealth() {
    return this.request('/health');
  }

  async getApiInfo() {
    return this.request('/');
  }

  // Authentication
  async login(email, password) {
    const data = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async signup(payload) {
    return this.request('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMe() {
    return this.request('/api/v1/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Diagnostic Centres & Tests
  async getCentres(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.size) query.append('size', params.size);
    if (params.name) query.append('name', params.name);
    if (params.location) query.append('location', params.location);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/v1/centres/${qs}`);
  }

  async getCentreDetails(centreId) {
    return this.request(`/api/v1/centres/${centreId}`);
  }

  async getTests(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.size) query.append('size', params.size);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/v1/tests/${qs}`);
  }

  async createCentre(payload) {
    return this.request('/api/v1/centres/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Bookings
  async createBooking(payload) {
    return this.request('/api/v1/bookings/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getBookings(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.size) query.append('size', params.size);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/v1/bookings/${qs}`);
  }

  async getBooking(bookingId) {
    return this.request(`/api/v1/bookings/${bookingId}`);
  }

  async cancelBooking(bookingId) {
    return this.request(`/api/v1/bookings/${bookingId}/cancel`, {
      method: 'POST',
    });
  }

  // Payments
  async createPayment(payload) {
    return this.request('/payments/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPayment(paymentId) {
    return this.request(`/payments/${paymentId}`);
  }

  async getPaymentByBooking(bookingId) {
    return this.request(`/payments/booking/${bookingId}`);
  }

  // Webhook Delivery
  async dispatchWebhook(payload, signature) {
    const headers = {};
    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }
    return this.request('/payments/webhook/', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiService();
