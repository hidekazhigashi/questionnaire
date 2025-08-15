$(document).ready(function() {
    let surveys = [];
    let responses = [];
    let filteredSurveys = [];
    let currentQrUrl = '';

    // 初期化
    loadData().then(() => {
        updateStats();
        filterAndRenderSurveys();
    });
    
    // フィルターイベント
    $('#search-input, #status-filter, #sort-filter').on('input change', function() {
        filterAndRenderSurveys();
    });

    // モーダル制御
    $('.close, .modal').on('click', function(e) {
        if (e.target === this) {
            $('.modal').hide();
        }
    });

    async function loadData() {
        try {
            surveys = await surveyAPI.getSurveys();
            responses = await surveyAPI.getResponses();
        } catch (error) {
            toastr.error('データの読み込みに失敗しました: ' + error.message);
            surveys = [];
            responses = [];
        }
    }

    function updateStats() {
        const publishedCount = surveys.filter(s => s.published).length;
        const draftCount = surveys.filter(s => !s.published).length;
        const totalResponses = responses.length;

        $('#total-surveys').text(surveys.length);
        $('#published-surveys').text(publishedCount);
        $('#draft-surveys').text(draftCount);
        $('#total-responses').text(totalResponses);
    }

    function filterAndRenderSurveys() {
        const searchTerm = $('#search-input').val().toLowerCase();
        const statusFilter = $('#status-filter').val();
        const sortFilter = $('#sort-filter').val();

        // フィルタリング
        filteredSurveys = surveys.filter(survey => {
            const matchesSearch = survey.title.toLowerCase().includes(searchTerm);
            const matchesStatus = statusFilter === '' || 
                                (statusFilter === 'published' && survey.published) ||
                                (statusFilter === 'draft' && !survey.published);
            
            return matchesSearch && matchesStatus;
        });

        // ソート
        filteredSurveys.sort((a, b) => {
            switch(sortFilter) {
                case 'created_asc':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'created_desc':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'title_asc':
                    return a.title.localeCompare(b.title);
                case 'title_desc':
                    return b.title.localeCompare(a.title);
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        renderSurveys();
    }

    function renderSurveys() {
        const container = $('#surveys-grid');
        const emptyState = $('#empty-state');
        
        if (filteredSurveys.length === 0) {
            container.hide();
            emptyState.show();
            return;
        }

        container.show();
        emptyState.hide();
        container.empty();

        filteredSurveys.forEach(survey => {
            const surveyResponses = responses.filter(r => r.surveyId == survey.id);
            const responseCount = surveyResponses.length;
            const statusBadge = survey.published ? 
                '<span class="status-badge status-published">公開中</span>' : 
                '<span class="status-badge status-draft">下書き</span>';

            const card = `
                <div class="survey-card" data-id="${survey.id}">
                    <div class="survey-card-header">
                        <div class="survey-card-title">${survey.title}</div>
                        <div class="survey-card-meta">
                            <span>作成: ${new Date(survey.createdAt).toLocaleDateString('ja-JP')}</span>
                            ${statusBadge}
                        </div>
                    </div>
                    <div class="survey-card-body">
                        <div class="survey-stats">
                            <div class="survey-stat">
                                <span class="survey-stat-number">${survey.questions.length}</span>
                                <span class="survey-stat-label">質問数</span>
                            </div>
                            <div class="survey-stat">
                                <span class="survey-stat-number">${responseCount}</span>
                                <span class="survey-stat-label">回答数</span>
                            </div>
                        </div>
                        <div class="survey-card-actions">
                            <button class="btn btn-sm btn-secondary btn-icon edit-survey">
                                ✏️ 編集
                            </button>
                            <button class="btn btn-sm ${survey.published ? 'btn-warning' : 'btn-success'} btn-icon toggle-publish">
                                ${survey.published ? '📝 非公開' : '🌐 公開'}
                            </button>
                            ${survey.published && survey.publicUrl ? `
                                <button class="btn btn-sm btn-primary btn-icon copy-url" data-url="${survey.publicUrl}">
                                    📋 URL
                                </button>
                                <button class="btn btn-sm btn-info btn-icon show-qr" data-url="${survey.publicUrl}">
                                    📱 QR
                                </button>
                                <button class="btn btn-sm btn-success btn-icon view-public" data-url="${survey.publicUrl}">
                                    👁️ 表示
                                </button>
                            ` : ''}
                            ${responseCount > 0 ? `
                                <button class="btn btn-sm btn-outline btn-icon view-responses">
                                    📊 回答
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger btn-icon delete-survey">
                                🗑️ 削除
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.append(card);
        });
    }

    // 編集ボタン
    $(document).on('click', '.edit-survey', function() {
        const surveyId = $(this).closest('.survey-card').data('id');
        window.location.href = `create.html?edit=${surveyId}`;
    });

    // 公開/非公開切り替え
    $(document).on('click', '.toggle-publish', async function() {
        const surveyId = $(this).closest('.survey-card').data('id');
        const survey = surveys.find(s => s.id == surveyId);
        
        if (!survey) return;

        const newPublishedState = !survey.published;
        
        try {
            const updatedSurvey = await surveyAPI.updateSurvey({
                id: survey.id,
                title: survey.title,
                questions: survey.questions,
                published: newPublishedState
            });
            
            // ローカルデータを更新
            const index = surveys.findIndex(s => s.id == surveyId);
            if (index !== -1) {
                surveys[index] = updatedSurvey;
            }
            
            const status = updatedSurvey.published ? '公開' : '非公開';
            toastr.success(`「${updatedSurvey.title}」を${status}にしました`);
            
            updateStats();
            filterAndRenderSurveys();
        } catch (error) {
            toastr.error('更新に失敗しました: ' + error.message);
        }
    });

    // URLコピー
    $(document).on('click', '.copy-url', function() {
        const url = $(this).data('url');
        navigator.clipboard.writeText(url).then(function() {
            toastr.success('URLをクリップボードにコピーしました');
        }).catch(function() {
            // フォールバック
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toastr.success('URLをクリップボードにコピーしました');
        });
    });

    // QRコード表示
    $(document).on('click', '.show-qr', function() {
        const url = $(this).data('url');
        currentQrUrl = url;
        showQrCode(url);
    });

    // 公開ページ表示
    $(document).on('click', '.view-public', function() {
        const url = $(this).data('url');
        window.open(url, '_blank');
    });

    // 回答表示
    $(document).on('click', '.view-responses', function() {
        const surveyId = $(this).closest('.survey-card').data('id');
        window.location.href = `responses.html?id=${surveyId}`;
    });

    // 削除
    $(document).on('click', '.delete-survey', async function() {
        const surveyId = $(this).closest('.survey-card').data('id');
        const survey = surveys.find(s => s.id == surveyId);
        
        if (!survey) return;

        if (confirm(`「${survey.title}」を削除しますか？\n※この操作は取り消せません。`)) {
            try {
                await surveyAPI.deleteSurvey(surveyId);
                
                // ローカルデータを更新
                surveys = surveys.filter(s => s.id != surveyId);
                responses = responses.filter(r => r.surveyId != surveyId);
                
                toastr.success('アンケートを削除しました');
                
                updateStats();
                filterAndRenderSurveys();
            } catch (error) {
                toastr.error('削除に失敗しました: ' + error.message);
            }
        }
    });

    // QRコード表示
    function showQrCode(url) {
        const qr = new QRious({
            element: document.createElement('canvas'),
            value: url,
            size: 200,
            background: 'white',
            foreground: 'black'
        });
        
        $('#qr-code-container').html(qr.element);
        $('#qr-modal').show();
    }

    // QRコードURLコピー
    $('#copy-qr-url').on('click', function() {
        navigator.clipboard.writeText(currentQrUrl).then(function() {
            toastr.success('URLをクリップボードにコピーしました');
        });
    });

    function generatePublicUrl(surveyId) {
        const baseUrl = window.location.origin + window.location.pathname.replace('manage.html', '');
        return `${baseUrl}survey.html?id=${surveyId}`;
    }

    // toastr設定
    toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": true,
        "progressBar": true,
        "positionClass": "toast-top-right",
        "preventDuplicates": false,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "3000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
    };
});