$(document).ready(function() {
    let survey = null;
    let responses = [];
    let filteredResponses = [];
    let currentResponseId = null;

    // URLパラメータからアンケートIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('id');

    if (!surveyId) {
        toastr.error('アンケートIDが指定されていません');
        window.location.href = 'index.html';
        return;
    }

    // 初期化
    loadData();

    // イベントリスナー
    $('#back-btn').on('click', function() {
        window.location.href = 'index.html';
    });

    $('#search-input, #date-from, #date-to').on('input change', function() {
        filterAndRenderResponses();
    });

    $('#clear-filter').on('click', function() {
        $('#search-input').val('');
        $('#date-from').val('');
        $('#date-to').val('');
        filterAndRenderResponses();
    });

    $('#export-csv-btn').on('click', function() {
        exportToCSV();
    });

    $('#share-survey').on('click', function() {
        if (survey && survey.publicUrl) {
            navigator.clipboard.writeText(survey.publicUrl).then(function() {
                toastr.success('アンケートURLをクリップボードにコピーしました');
            });
        }
    });

    // モーダル制御
    $('.close, #close-detail-btn').on('click', function() {
        $('#response-detail-modal').hide();
    });

    $('.modal').on('click', function(e) {
        if (e.target === this) {
            $(this).hide();
        }
    });

    $('#delete-response').on('click', function() {
        if (currentResponseId && confirm('この回答を削除しますか？\n※この操作は取り消せません。')) {
            deleteResponse(currentResponseId);
        }
    });

    // 回答詳細ボタンクリックイベント
    $(document).on('click', '.view-detail', function(e) {
        e.stopPropagation();
        const responseId = $(this).closest('.response-row').data('id');
        console.log('Detail button clicked, responseId:', responseId);
        showResponseDetail(responseId);
    });

    // 回答行クリックイベント
    $(document).on('click', '.response-row', function() {
        const responseId = $(this).data('id');
        console.log('Row clicked, responseId:', responseId);
        showResponseDetail(responseId);
    });

    async function loadData() {
        try {
            // アンケート情報を取得
            survey = await surveyAPI.getSurvey(surveyId);
            
            // 回答データを取得
            responses = await surveyAPI.getResponses({ surveyId: surveyId });
            console.log('Loaded responses:', responses);
            
            // UIを更新
            updateSurveyInfo();
            updateStats();
            renderQuestionAnalysis();
            filterAndRenderResponses();
            
        } catch (error) {
            toastr.error('データの読み込みに失敗しました: ' + error.message);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    }

    function updateSurveyInfo() {
        $('#survey-title').text(survey.title + ' - 回答一覧');
        $('#survey-question-count').text(survey.questions.length);
        $('#survey-created-date').text(new Date(survey.createdAt).toLocaleDateString('ja-JP'));
    }

    function updateStats() {
        const totalResponses = responses.length;
        $('#total-responses').text(totalResponses);

        // 完答率計算（すべての必須質問に回答している割合）
        const requiredQuestions = survey.questions.filter(q => q.required);
        let completedResponses = 0;
        
        responses.forEach(response => {
            let isCompleted = true;
            requiredQuestions.forEach((question, index) => {
                const questionName = `question_${survey.questions.indexOf(question)}`;
                const answer = response.answers[questionName];
                if (!answer || (Array.isArray(answer) && answer.length === 0)) {
                    isCompleted = false;
                }
            });
            if (isCompleted) completedResponses++;
        });

        const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;
        $('#avg-completion-rate').text(completionRate + '%');

        // 最新回答日時
        if (totalResponses > 0) {
            const latestResponse = responses.reduce((latest, current) => {
                return new Date(current.submittedAt) > new Date(latest.submittedAt) ? current : latest;
            });
            $('#latest-response').text(new Date(latestResponse.submittedAt).toLocaleDateString('ja-JP'));
        } else {
            $('#latest-response').text('-');
        }
    }

    function renderQuestionAnalysis() {
        const container = $('#question-analysis');
        container.empty();

        if (responses.length === 0) {
            return;
        }

        survey.questions.forEach((question, questionIndex) => {
            const questionName = `question_${questionIndex}`;
            const questionAnswers = responses.map(r => r.answers[questionName]).filter(a => a !== undefined && a !== '');

            const questionCard = $(`
                <div class="question-card">
                    <div class="question-header">
                        <div class="question-title"></div>
                        <div class="question-type">${getQuestionTypeName(question.type)} | ${questionAnswers.length}件の回答</div>
                    </div>
                    <div class="question-answers" id="answers-${questionIndex}">
                    </div>
                </div>
            `);

            // XSS対策: 質問タイトルを安全にテキストとして設定
            questionCard.find('.question-title').text(question.title);
            
            const answersContainer = questionCard.find(`#answers-${questionIndex}`);

            if (question.type === 'radio' || question.type === 'checkbox' || question.type === 'select') {
                // 選択肢の統計
                renderChoiceStats(answersContainer, question, questionAnswers);
            } else {
                // テキスト回答の一覧
                renderTextAnswers(answersContainer, questionAnswers);
            }

            container.append(questionCard);
        });
    }

    function getQuestionTypeName(type) {
        const typeNames = {
            'text': '一行テキスト',
            'textarea': '複数行テキスト',
            'radio': 'ラジオボタン',
            'checkbox': 'チェックボックス',
            'select': 'ドロップダウン'
        };
        return typeNames[type] || type;
    }

    function renderChoiceStats(container, question, answers) {
        const choiceCounts = {};
        
        // 選択肢の初期化
        question.options.forEach(option => {
            choiceCounts[option] = 0;
        });

        // 回答をカウント
        answers.forEach(answer => {
            if (question.type === 'checkbox' && Array.isArray(answer)) {
                answer.forEach(choice => {
                    if (choiceCounts.hasOwnProperty(choice)) {
                        choiceCounts[choice]++;
                    }
                });
            } else {
                if (choiceCounts.hasOwnProperty(answer)) {
                    choiceCounts[answer]++;
                }
            }
        });

        const totalAnswers = question.type === 'checkbox' 
            ? answers.reduce((sum, answer) => sum + (Array.isArray(answer) ? answer.length : 1), 0)
            : answers.length;

        const statsHtml = $('<div class="choice-stats"></div>');
        
        Object.entries(choiceCounts).forEach(([choice, count]) => {
            const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
            const barHtml = $(`
                <div class="choice-bar">
                    <div class="choice-label"></div>
                    <div class="choice-progress">
                        <div class="choice-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="choice-count">${count}件 (${percentage}%)</div>
                </div>
            `);
            // XSS対策: 選択肢ラベルを安全にテキストとして設定
            barHtml.find('.choice-label').text(choice);
            statsHtml.append(barHtml);
        });

        container.append(statsHtml);
    }

    function renderTextAnswers(container, answers) {
        if (answers.length === 0) {
            container.append('<p style="color: #6c757d; font-style: italic;">回答がありません</p>');
            return;
        }

        // 最新の5件を表示
        const recentAnswers = answers.slice(-5).reverse();
        
        recentAnswers.forEach(answer => {
            const answerHtml = $(`
                <div class="answer-item">
                    <div class="answer-text">${escapeHtml(answer)}</div>
                </div>
            `);
            container.append(answerHtml);
        });

        if (answers.length > 5) {
            container.append(`<p style="color: #6c757d; font-size: 0.9rem; margin-top: 15px;">他 ${answers.length - 5}件の回答</p>`);
        }
    }

    function filterAndRenderResponses() {
        const searchTerm = $('#search-input').val().toLowerCase();
        const dateFrom = $('#date-from').val();
        const dateTo = $('#date-to').val();

        filteredResponses = responses.filter(response => {
            // テキスト検索
            if (searchTerm) {
                const answerTexts = Object.values(response.answers).join(' ').toLowerCase();
                if (!answerTexts.includes(searchTerm)) {
                    return false;
                }
            }

            // 日付フィルター
            const responseDate = new Date(response.submittedAt).toISOString().split('T')[0];
            if (dateFrom && responseDate < dateFrom) {
                return false;
            }
            if (dateTo && responseDate > dateTo) {
                return false;
            }

            return true;
        });

        renderResponsesTable();
    }

    function renderResponsesTable() {
        const tbody = $('#responses-tbody');
        tbody.empty();

        $('#filtered-count').text(`${filteredResponses.length}件`);

        if (filteredResponses.length === 0) {
            if (responses.length === 0) {
                $('.responses-table-container').hide();
                $('#no-responses').show();
            } else {
                tbody.append(`
                    <tr>
                        <td colspan="4" style="text-align: center; color: #6c757d; font-style: italic;">
                            フィルター条件に一致する回答がありません
                        </td>
                    </tr>
                `);
            }
            return;
        }

        $('.responses-table-container').show();
        $('#no-responses').hide();

        filteredResponses.forEach(response => {
            const submittedDate = new Date(response.submittedAt);
            const row = $(`
                <tr class="response-row" data-id="${response.id}">
                    <td>${response.id.substring(0, 8)}...</td>
                    <td class="response-timestamp">${submittedDate.toLocaleString('ja-JP')}</td>
                    <td class="response-ip">${response.ipAddress}</td>
                    <td>
                        <button class="btn btn-sm btn-primary view-detail">詳細</button>
                    </td>
                </tr>
            `);
            tbody.append(row);
        });
    }

    function showResponseDetail(responseId) {
        const response = responses.find(r => r.id == responseId);
        if (!response) {
            console.error('Response not found:', responseId);
            toastr.error('回答データが見つかりません');
            return;
        }

        currentResponseId = responseId;
        
        const detailContent = $('#response-detail-content');
        detailContent.empty();

        // 回答メタ情報
        const metaInfo = $(`
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <strong>回答ID:</strong> ${response.id}<br>
                <strong>回答日時:</strong> ${new Date(response.submittedAt).toLocaleString('ja-JP')}<br>
                <strong>IPアドレス:</strong> ${response.ipAddress}
            </div>
        `);
        detailContent.append(metaInfo);

        // 各質問の回答
        const responseDetail = $('<div class="response-detail"></div>');
        
        survey.questions.forEach((question, index) => {
            const questionName = `question_${index}`;
            const answer = response.answers[questionName];

            const questionDiv = $(`
                <div class="response-question">
                    <div class="response-question-title"></div>
                    <div class="response-answer"></div>
                </div>
            `);

            // XSS対策: 質問タイトルを安全にテキストとして設定
            questionDiv.find('.response-question-title').text(`${index + 1}. ${question.title}`);
            
            const answerDiv = questionDiv.find('.response-answer');
            
            if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
                answerDiv.html('<em style="color: #6c757d;">未回答</em>');
            } else if (Array.isArray(answer)) {
                answerDiv.text(answer.join(', '));
            } else {
                answerDiv.text(answer);
            }

            responseDetail.append(questionDiv);
        });

        detailContent.append(responseDetail);
        $('#response-detail-modal').show();
    }

    async function deleteResponse(responseId) {
        try {
            await surveyAPI.deleteResponse(responseId);
            
            // ローカルデータを更新
            responses = responses.filter(r => r.id != responseId);
            
            toastr.success('回答を削除しました');
            $('#response-detail-modal').hide();
            
            // UIを更新
            updateStats();
            renderQuestionAnalysis();
            filterAndRenderResponses();
            
        } catch (error) {
            toastr.error('削除に失敗しました: ' + error.message);
        }
    }

    function exportToCSV() {
        if (filteredResponses.length === 0) {
            toastr.warning('エクスポートする回答がありません');
            return;
        }

        // CSVヘッダーを作成
        const headers = ['回答ID', '回答日時', 'IPアドレス'];
        survey.questions.forEach((question, index) => {
            headers.push(`Q${index + 1}: ${question.title}`);
        });

        // CSVデータを作成
        const csvData = [headers];
        
        filteredResponses.forEach(response => {
            const row = [
                response.id,
                new Date(response.submittedAt).toLocaleString('ja-JP'),
                response.ipAddress
            ];
            
            survey.questions.forEach((question, index) => {
                const questionName = `question_${index}`;
                const answer = response.answers[questionName];
                
                if (answer === undefined || answer === '') {
                    row.push('');
                } else if (Array.isArray(answer)) {
                    row.push(answer.join('; '));
                } else {
                    row.push(answer);
                }
            });
            
            csvData.push(row);
        });

        // CSVファイルを生成してダウンロード
        const csvContent = csvData.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${survey.title}_回答データ_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toastr.success('CSVファイルをダウンロードしました');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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