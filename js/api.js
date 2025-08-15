// API通信用の共通関数
class SurveyAPI {
    constructor() {
        this.baseUrl = './api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // アンケート関連API
    async getSurveys(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `surveys.php?${queryString}` : 'surveys.php';
        return this.request(endpoint);
    }

    async getSurvey(id) {
        return this.request(`surveys.php?id=${id}`);
    }

    async createSurvey(surveyData) {
        return this.request('surveys.php', {
            method: 'POST',
            body: JSON.stringify(surveyData)
        });
    }

    async updateSurvey(surveyData) {
        return this.request('surveys.php', {
            method: 'PUT',
            body: JSON.stringify(surveyData)
        });
    }

    async deleteSurvey(id) {
        return this.request('surveys.php', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
    }

    // 回答関連API
    async getResponses(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `responses.php?${queryString}` : 'responses.php';
        return this.request(endpoint);
    }

    async createResponse(responseData) {
        return this.request('responses.php', {
            method: 'POST',
            body: JSON.stringify(responseData)
        });
    }

    async deleteResponse(id) {
        return this.request('responses.php', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
    }

    async getResponseStats(surveyId = null) {
        const params = { stats: 'true' };
        if (surveyId) {
            params.surveyId = surveyId;
        }
        return this.getResponses(params);
    }
}

// グローバルインスタンス
const surveyAPI = new SurveyAPI();