import axios from "axios";
import axiosRetry from "axios-retry";

const httpClient = axios.create({ timeout: 5000 });

axiosRetry(httpClient, {
  retries: 5,
  retryDelay: (retryCount) => Math.min(2 ** retryCount * 250, 4000),
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 429,
});

export default httpClient;
