import axios from 'axios';

const aiApi = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

aiApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log("AI API Token:", token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default aiApi;
