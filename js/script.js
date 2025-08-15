$(document).ready(function() {
    let currentQuestionIndex = 0;
    let questions = [];
    let hasResponses = false; // 回答があるかどうかのフラグ
    let currentSurvey = {
        id: null,
        title: '',
        questions: [],
        published: false,
        publicUrl: null,
        createdAt: new Date().toISOString()
    };

    // ドラッグ&ドロップ機能
    initializeDragAndDrop();
    
    // モーダル機能
    initializeModals();
    
    // ボタンイベント
    initializeButtons();
    
    // URLパラメータから編集対象のアンケートIDを取得（後で実行）

    function initializeDragAndDrop() {
        const questionTypes = $('.question-type');
        const dropZone = $('#drop-zone');

        questionTypes.on('dragstart', function(e) {
            e.originalEvent.dataTransfer.setData('text/plain', $(this).data('type'));
            $(this).addClass('dragging');
        });

        questionTypes.on('dragend', function() {
            $(this).removeClass('dragging');
        });

        dropZone.on('dragover', function(e) {
            e.preventDefault();
            $(this).addClass('drag-over');
        });

        dropZone.on('dragleave', function() {
            $(this).removeClass('drag-over');
        });

        dropZone.on('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('drag-over');
            
            // 回答がある場合はドロップを無効化
            if (hasResponses) {
                toastr.error('このアンケートには回答があるため、新しい質問を追加できません。');
                return;
            }
            
            const questionType = e.originalEvent.dataTransfer.getData('text/plain');
            createQuestion(questionType);
        });
    }

    function createQuestion(type) {
        // 回答がある場合は新しい質問の作成を禁止
        if (hasResponses) {
            toastr.error('このアンケートには回答があるため、新しい質問を追加できません。');
            return;
        }
        
        const question = {
            id: Date.now(),
            type: type,
            title: getDefaultTitle(type),
            required: type === 'label' || type === 'parameter' ? false : false,
            options: type === 'radio' || type === 'checkbox' || type === 'select' ? ['選択肢1', '選択肢2'] : [],
            conditions: [],
            parameterName: type === 'parameter' ? '' : undefined
        };

        questions.push(question);
        renderQuestion(question);
        hideDropZonePlaceholder();
        // 新しい質問が追加された後、ドラッグ&ドロップを再初期化
        initializeQuestionDragAndDrop();
    }

    function getDefaultTitle(type) {
        const titles = {
            'text': '一行テキストの質問',
            'email': 'メールアドレスの質問',
            'textarea': '複数行テキストの質問',
            'radio': 'ラジオボタンの質問',
            'checkbox': 'チェックボックスの質問',
            'select': 'ドロップダウンの質問',
            'label': 'ラベル・説明文',
            'parameter': 'パラメータ質問'
        };
        return titles[type] || '質問';
    }

    function renderQuestion(question) {
        const questionIndex = questions.findIndex(q => q.id === question.id);
        const isFirst = questionIndex === 0;
        const isLast = questionIndex === questions.length - 1;
        
        // ラベルタイプ以外の質問数をカウントして番号を決定
        const actualQuestionNumber = questions.slice(0, questionIndex).filter(q => q.type !== 'label').length + (question.type !== 'label' ? 1 : 0);
        const questionNumberDisplay = question.type === 'label' ? '' : `${actualQuestionNumber}.`;
        
        const questionHtml = `
            <div class="question-item ${question.type === 'label' ? 'label-item' : ''}" data-id="${question.id}" draggable="true">
                <div class="question-header">
                    <div class="question-order-controls">
                        <button class="btn btn-sm btn-outline move-up" ${isFirst ? 'disabled' : ''} title="上に移動">
                            ↑
                        </button>
                        <button class="btn btn-sm btn-outline move-down" ${isLast ? 'disabled' : ''} title="下に移動">
                            ↓
                        </button>
                        <span class="question-number">${questionNumberDisplay}</span>
                    </div>
                    <span class="question-title">${question.title}</span>
                    <div class="question-actions">
                        <button class="btn btn-sm btn-secondary edit-question">編集</button>
                        <button class="btn btn-sm btn-danger delete-question">削除</button>
                    </div>
                </div>
                <div class="question-content">
                    ${renderQuestionPreview(question)}
                </div>
            </div>
        `;

        if ($('.drop-zone-placeholder').is(':visible')) {
            $('.drop-zone-placeholder').hide();
        }
        
        $('#drop-zone').append(questionHtml);
    }

    function renderQuestionPreview(question) {
        let html = '';
        
        switch(question.type) {
            case 'text':
                html = '<input type="text" class="form-control" placeholder="回答を入力してください" disabled>';
                break;
            case 'email':
                html = '<input type="email" class="form-control" placeholder="example@domain.com" disabled>';
                break;
            case 'textarea':
                html = '<textarea class="form-control" rows="3" placeholder="回答を入力してください" disabled></textarea>';
                break;
            case 'radio':
                question.options.forEach((option, index) => {
                    html += `
                        <div class="form-check">
                            <input type="radio" name="radio_${question.id}" id="radio_${question.id}_${index}" disabled>
                            <label for="radio_${question.id}_${index}">${option}</label>
                        </div>
                    `;
                });
                break;
            case 'checkbox':
                question.options.forEach((option, index) => {
                    html += `
                        <div class="form-check">
                            <input type="checkbox" id="checkbox_${question.id}_${index}" disabled>
                            <label for="checkbox_${question.id}_${index}">${option}</label>
                        </div>
                    `;
                });
                break;
            case 'select':
                html = '<select class="form-control" disabled>';
                html += '<option>選択してください</option>';
                question.options.forEach(option => {
                    html += `<option>${option}</option>`;
                });
                html += '</select>';
                break;
            case 'label':
                html = `<div class="label-content">${question.title}</div>`;
                break;
            case 'parameter':
                const paramName = question.parameterName || '未設定';
                html = `<div class="parameter-info">URLパラメータ: <code>${paramName}</code></div>`;
                break;
        }
        
        return html;
    }

    function hideDropZonePlaceholder() {
        if (questions.length > 0) {
            $('.drop-zone-placeholder').hide();
        }
    }

    function showDropZonePlaceholder() {
        if (questions.length === 0) {
            $('.drop-zone-placeholder').show();
        }
    }

    // 質問編集・削除イベント
    $(document).on('click', '.edit-question', function() {
        const questionId = $(this).closest('.question-item').data('id');
        const question = questions.find(q => q.id == questionId);
        if (question) {
            openEditModal(question);
        } else {
            toastr.error('質問が見つかりません');
        }
    });

    $(document).on('click', '.delete-question', function() {
        // 回答がある場合は質問の削除を禁止
        if (hasResponses) {
            toastr.error('このアンケートには回答があるため、質問を削除できません。');
            return;
        }
        
        const questionId = $(this).closest('.question-item').data('id');
        if (confirm('この質問を削除しますか？')) {
            questions = questions.filter(q => q.id != questionId);
            $(this).closest('.question-item').remove();
            showDropZonePlaceholder();
            // 質問番号を更新
            reorderQuestions();
        }
    });

    // 質問順序移動ボタンのイベント
    $(document).on('click', '.move-up', function() {
        if (hasResponses) {
            toastr.error('このアンケートには回答があるため、質問の順序を変更できません。');
            return;
        }
        
        const questionId = $(this).closest('.question-item').data('id');
        moveQuestion(questionId, 'up');
    });

    $(document).on('click', '.move-down', function() {
        if (hasResponses) {
            toastr.error('このアンケートには回答があるため、質問の順序を変更できません。');
            return;
        }
        
        const questionId = $(this).closest('.question-item').data('id');
        moveQuestion(questionId, 'down');
    });

    function openEditModal(question) {
        currentQuestionIndex = questions.findIndex(q => q.id == question.id);
        
        $('#question-text').val(question.title);
        $('#required-checkbox').prop('checked', question.required);
        
        // 回答がある場合は構造的な変更を制限
        if (hasResponses) {
            // 必須設定の変更を禁止
            $('#required-checkbox').prop('disabled', true);
            
            // 選択肢の編集を禁止
            if (question.type === 'radio' || question.type === 'checkbox' || question.type === 'select') {
                $('#options-group').show();
                renderOptionsEditor(question.options);
                
                // 選択肢の編集を無効化
                $('#options-container input').prop('disabled', true);
                $('.remove-option').prop('disabled', true).addClass('disabled-btn');
                $('#add-option').prop('disabled', true).addClass('disabled-btn');
                
                // 警告メッセージを追加
                if (!$('#options-warning').length) {
                    $('#options-group').prepend(`
                        <div id="options-warning" class="alert alert-warning" style="margin-bottom: 15px;">
                            ⚠️ このアンケートには回答があるため、選択肢や必須設定は変更できません。
                        </div>
                    `);
                }
            } else {
                $('#options-group').hide();
            }
        } else {
            // 制限を解除
            $('#required-checkbox').prop('disabled', false);
            $('#options-warning').remove();
            
            if (question.type === 'radio' || question.type === 'checkbox' || question.type === 'select') {
                $('#options-group').show();
                renderOptionsEditor(question.options);
                
                $('#options-container input').prop('disabled', false);
                $('.remove-option').prop('disabled', false).removeClass('disabled-btn');
                $('#add-option').prop('disabled', false).removeClass('disabled-btn');
            } else {
                $('#options-group').hide();
            }
        }
        
        // ラベルタイプとパラメータタイプの場合は必須設定を無効化
        if (question.type === 'label' || question.type === 'parameter') {
            $('#required-checkbox').prop('disabled', true).prop('checked', false);
        }
        
        // パラメータタイプの場合はパラメータ名設定を表示
        if (question.type === 'parameter') {
            $('#parameter-group').show();
            $('#parameter-name').val(question.parameterName || '');
        } else {
            $('#parameter-group').hide();
        }
        
        // 条件設定を表示
        renderConditionsEditor(question.conditions || []);
        
        $('#edit-modal').show();
    }

    function renderOptionsEditor(options) {
        const container = $('#options-container');
        container.empty();
        
        options.forEach((option, index) => {
            const optionHtml = `
                <div class="option-item">
                    <input type="text" class="option-input" value="${option}" data-index="${index}">
                    <button type="button" class="remove-option">削除</button>
                </div>
            `;
            container.append(optionHtml);
        });
    }

    $(document).on('click', '#add-option', function() {
        const container = $('#options-container');
        const index = container.children().length;
        const optionHtml = `
            <div class="option-item">
                <input type="text" class="option-input" value="新しい選択肢" data-index="${index}">
                <button type="button" class="remove-option">削除</button>
            </div>
        `;
        container.append(optionHtml);
    });

    $(document).on('click', '.remove-option', function() {
        $(this).closest('.option-item').remove();
        // インデックスを再設定
        $('#options-container .option-input').each(function(index) {
            $(this).attr('data-index', index);
        });
    });

    // 条件設定エディタ
    function renderConditionsEditor(conditions) {
        const container = $('#conditions-container');
        container.empty();
        
        conditions.forEach((condition, index) => {
            addConditionItem(condition, index);
        });
    }
    
    function addConditionItem(condition = null, index = null) {
        const container = $('#conditions-container');
        const currentIndex = index !== null ? index : container.children().length;
        
        // 他の質問を取得（現在編集中の質問を除く）
        const currentQuestionId = questions[currentQuestionIndex]?.id;
        const availableQuestions = questions.filter(q => q.id !== currentQuestionId && ['radio', 'checkbox', 'select'].includes(q.type));
        
        if (availableQuestions.length === 0) {
            toastr.warning('条件に使用できる質問（ラジオボタン、チェックボックス、ドロップダウン）がありません');
            return;
        }
        
        let questionOptions = '';
        availableQuestions.forEach(q => {
            const selected = condition && condition.targetQuestionId == q.id ? 'selected' : '';
            questionOptions += `<option value="${q.id}" ${selected}>${q.title}</option>`;
        });
        
        const operatorOptions = `
            <option value="equals" ${condition && condition.operator === 'equals' ? 'selected' : ''}>等しい</option>
            <option value="contains" ${condition && condition.operator === 'contains' ? 'selected' : ''}>含む</option>
            <option value="not_equals" ${condition && condition.operator === 'not_equals' ? 'selected' : ''}>等しくない</option>
        `;
        
        const conditionHtml = `
            <div class="condition-item" data-index="${currentIndex}">
                <label>質問:</label>
                <select class="condition-select target-question">${questionOptions}</select>
                <label>条件:</label>
                <select class="condition-select operator">${operatorOptions}</select>
                <label>値:</label>
                <input type="text" class="condition-value" value="${condition ? condition.value : ''}" placeholder="条件値を入力">
                <button type="button" class="remove-condition">削除</button>
            </div>
        `;
        
        container.append(conditionHtml);
        
        // 質問選択が変更されたときに値の候補を更新
        container.find('.target-question').last().on('change', function() {
            updateConditionValue($(this));
        });
        
        // 初期値の候補を設定
        if (condition) {
            updateConditionValue(container.find('.target-question').last());
        }
    }
    
    function updateConditionValue(selectElement) {
        const questionId = selectElement.val();
        const question = questions.find(q => q.id == questionId);
        const valueInput = selectElement.closest('.condition-item').find('.condition-value');
        
        if (question && question.options) {
            // 選択肢がある場合、placeholderを設定
            valueInput.attr('placeholder', '例: ' + question.options.join(', '));
        }
    }
    
    $(document).on('click', '#add-condition', function() {
        addConditionItem();
    });
    
    $(document).on('click', '.remove-condition', function() {
        $(this).closest('.condition-item').remove();
        // インデックスを再設定
        $('#conditions-container .condition-item').each(function(index) {
            $(this).attr('data-index', index);
        });
    });

    function initializeModals() {
        // モーダルを閉じる
        $('.close, #close-preview-btn, #cancel-edit').on('click', function() {
            $('.modal').hide();
        });

        // モーダル外クリックで閉じる
        $('.modal').on('click', function(e) {
            if (e.target === this) {
                $(this).hide();
            }
        });

        // 質問保存
        $('#save-question').on('click', function() {
            saveQuestion();
        });
    }

    function saveQuestion() {
        if (currentQuestionIndex === -1) {
            toastr.error('編集対象の質問が見つかりません');
            return;
        }
        
        const question = questions[currentQuestionIndex];
        
        // 質問文は常に編集可能
        question.title = $('#question-text').val();
        
        // 回答がない場合のみ構造的な変更を許可
        if (!hasResponses) {
            question.required = $('#required-checkbox').is(':checked');
            
            if (question.type === 'radio' || question.type === 'checkbox' || question.type === 'select') {
                const options = [];
                $('#options-container .option-input').each(function() {
                    const value = $(this).val().trim();
                    if (value) {
                        options.push(value);
                    }
                });
                question.options = options;
            }
            
            // 条件の保存
            const conditions = [];
            $('#conditions-container .condition-item').each(function() {
                const targetQuestionId = $(this).find('.target-question').val();
                const operator = $(this).find('.operator').val();
                const value = $(this).find('.condition-value').val().trim();
                
                if (targetQuestionId && operator && value) {
                    conditions.push({
                        targetQuestionId: parseInt(targetQuestionId),
                        operator: operator,
                        value: value
                    });
                }
            });
            question.conditions = conditions;
            
            // パラメータ名の保存
            if (question.type === 'parameter') {
                question.parameterName = $('#parameter-name').val().trim();
            }
        }
        
        // UIを更新
        const questionItem = $(`.question-item[data-id="${question.id}"]`);
        questionItem.find('.question-title').text(question.title);
        questionItem.find('.question-content').html(renderQuestionPreview(question));
        
        // 質問番号を再計算
        updateQuestionNumbers();
        
        $('#edit-modal').hide();
        toastr.success('質問が更新されました');
    }
    
    function updateQuestionNumbers() {
        $('.question-item').each(function(index) {
            const questionId = $(this).data('id');
            const question = questions.find(q => q.id == questionId);
            
            if (question && question.type !== 'label') {
                // ラベル以外の質問のみ番号を計算
                const actualQuestionNumber = questions.slice(0, index).filter(q => q.type !== 'label').length + 1;
                $(this).find('.question-number').text(`${actualQuestionNumber}.`);
            } else {
                $(this).find('.question-number').text('');
            }
        });
    }

    function initializeButtons() {
        // プレビューボタン
        $('#preview-btn').on('click', function() {
            showPreview();
        });

        // 保存ボタン
        $('#save-btn').on('click', function() {
            saveSurvey();
        });

        // 公開ボタン
        $('#publish-btn').on('click', function() {
            publishSurvey();
        });
    }

    function showPreview() {
        const title = $('#survey-title').val() || 'アンケート';
        let previewHtml = `<h2>${title}</h2>`;
        
        if (questions.length === 0) {
            previewHtml += '<p>質問がありません。左側から質問タイプをドラッグしてください。</p>';
        } else {
            questions.forEach((question, index) => {
                previewHtml += `
                    <div class="preview-question">
                        <h4>${index + 1}. ${question.title} ${question.required ? '<span style="color: red;">*</span>' : ''}</h4>
                        <div class="preview-answer">
                            ${renderQuestionPreview(question)}
                        </div>
                    </div>
                `;
            });
            previewHtml += '<button type="submit" class="btn btn-primary" disabled>回答を送信</button>';
        }
        
        $('#preview-content').html(previewHtml);
        $('#preview-modal').show();
    }

    function saveSurvey() {
        const title = $('#survey-title').val();
        if (!title) {
            toastr.error('アンケートタイトルを入力してください');
            return;
        }
        
        if (questions.length === 0) {
            toastr.error('質問を最低1つ追加してください');
            return;
        }

        const surveyData = {
            title: title,
            questions: [...questions],
            published: currentSurvey.published || false
        };

        // 既存アンケートの場合はIDを追加
        if (currentSurvey.id) {
            surveyData.id = currentSurvey.id;
        }

        // API経由で保存
        saveSurveyToAPI(surveyData);
    }

    function publishSurvey() {
        if (!currentSurvey.id) {
            toastr.warning('まずアンケートを保存してください');
            return;
        }
        
        const newPublishedState = !currentSurvey.published;
        
        const surveyData = {
            id: currentSurvey.id,
            title: currentSurvey.title,
            questions: currentSurvey.questions,
            published: newPublishedState
        };
        
        // API経由で更新
        updateSurveyToAPI(surveyData);
    }

    // API通信関数
    async function saveSurveyToAPI(surveyData) {
        try {
            let result;
            if (surveyData.id) {
                // 更新
                result = await surveyAPI.updateSurvey(surveyData);
            } else {
                // 新規作成
                result = await surveyAPI.createSurvey(surveyData);
            }
            
            currentSurvey = result;
            questions = [...result.questions];
            
            // UIを更新
            $('#publish-btn').text(result.published ? '非公開にする' : '公開');
            
            toastr.success('アンケートが保存されました');
        } catch (error) {
            toastr.error('保存に失敗しました: ' + error.message);
        }
    }

    async function updateSurveyToAPI(surveyData) {
        try {
            const result = await surveyAPI.updateSurvey(surveyData);
            currentSurvey = result;
            
            const status = result.published ? '公開' : '非公開';
            toastr.success(`アンケートを${status}にしました`);
            
            // ボタンテキストを更新
            $('#publish-btn').text(result.published ? '非公開にする' : '公開');
        } catch (error) {
            toastr.error('更新に失敗しました: ' + error.message);
        }
    }

    // URLパラメータから編集対象のアンケートIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const editSurveyId = urlParams.get('edit');
    
    if (editSurveyId) {
        loadSurveyFromAPI(editSurveyId);
    }

    async function loadSurveyFromAPI(surveyId) {
        try {
            const survey = await surveyAPI.getSurvey(surveyId);
            loadSurvey(survey);
            toastr.info('編集モードでアンケートを読み込みました');
        } catch (error) {
            toastr.error('アンケートの読み込みに失敗しました: ' + error.message);
        }
    }

    function loadSurvey(survey) {
        currentSurvey = { ...survey };
        questions = [...survey.questions];
        
        // 回答数をチェック
        checkSurveyResponses(survey.id);
        
        // UIを更新
        $('#survey-title').val(survey.title);
        $('#publish-btn').text(survey.published ? '非公開にする' : '公開');
        
        // 質問をレンダリング
        $('#drop-zone').empty();
        if (questions.length === 0) {
            showDropZonePlaceholder();
        } else {
            questions.forEach(question => {
                renderQuestion(question);
            });
            // 全ての質問がレンダリングされた後にドラッグ&ドロップを初期化
            initializeQuestionDragAndDrop();
        }
    }

    // 回答数をチェックして編集制限を設定する関数
    async function checkSurveyResponses(surveyId) {
        if (!surveyId) {
            hasResponses = false;
            updateEditingRestrictions();
            return;
        }
        
        try {
            const responses = await surveyAPI.getResponses({ surveyId: surveyId });
            hasResponses = responses.length > 0;
            updateEditingRestrictions();
            
            if (hasResponses) {
                toastr.warning(`このアンケートには${responses.length}件の回答があります。質問構造の変更はできません。`);
            }
        } catch (error) {
            console.error('回答数の取得に失敗:', error);
            hasResponses = false;
            updateEditingRestrictions();
        }
    }

    // 編集制限を更新する関数
    function updateEditingRestrictions() {
        if (hasResponses) {
            // ドラッグ&ドロップを無効化
            $('.question-type').attr('draggable', false).addClass('disabled-drag');
            $('#drop-zone').addClass('disabled-drop');
            
            // 質問の削除ボタンを無効化
            $('.delete-question').prop('disabled', true).addClass('disabled-btn');
            
            // 質問順序変更ボタンを無効化
            $('.move-up, .move-down').prop('disabled', true).addClass('disabled-btn');
            $('.question-item').attr('draggable', false).addClass('disabled-drag');
            
            // 新しい質問追加を制限する警告を表示
            if (!$('.editing-warning').length) {
                $('#drop-zone').before(`
                    <div class="editing-warning alert alert-warning">
                        ⚠️ このアンケートには回答があるため、質問の追加・削除・順序変更はできません。<br>
                        タイトルや質問文の編集、公開設定の変更は可能です。
                    </div>
                `);
            }
        } else {
            // 制限を解除
            $('.question-type').attr('draggable', true).removeClass('disabled-drag');
            $('#drop-zone').removeClass('disabled-drop');
            $('.delete-question').prop('disabled', false).removeClass('disabled-btn');
            $('.move-up, .move-down').prop('disabled', false).removeClass('disabled-btn');
            $('.question-item').attr('draggable', true).removeClass('disabled-drag');
            $('.editing-warning').remove();
        }
    }

    // 質問の移動を処理する関数
    function moveQuestion(questionId, direction) {
        const currentIndex = questions.findIndex(q => q.id == questionId);
        if (currentIndex === -1) return;

        let newIndex;
        if (direction === 'up' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < questions.length - 1) {
            newIndex = currentIndex + 1;
        } else {
            return; // 移動できない場合
        }

        // 配列内で要素を交換
        [questions[currentIndex], questions[newIndex]] = [questions[newIndex], questions[currentIndex]];
        
        // UIを再描画
        reorderQuestions();
        toastr.success('質問の順序を変更しました');
    }

    // 質問の順序を更新してUIを再描画する関数
    function reorderQuestions() {
        const dropZone = $('#drop-zone');
        dropZone.empty();
        
        if (questions.length === 0) {
            showDropZonePlaceholder();
            return;
        }
        
        questions.forEach(question => {
            renderQuestion(question);
        });
        
        // 質問番号を更新
        updateQuestionNumbers();
        
        // ドラッグ&ドロップを再初期化
        setTimeout(() => {
            initializeQuestionDragAndDrop();
        }, 10);
    }

    // 質問のドラッグ&ドロップソート機能を初期化
    function initializeQuestionSorting() {
        if (hasResponses) return; // 回答がある場合は無効化
        
        $('.question-item').off('dragstart dragend');
        $('#drop-zone').off('dragover dragenter drop');
        
        initializeQuestionDragAndDrop();
    }

    // 質問間のドラッグ&ドロップ機能
    function initializeQuestionDragAndDrop() {
        if (hasResponses) return; // 回答がある場合は無効化
        
        // 既存のイベントリスナーを削除
        $('.question-item').off('dragstart.questionSort dragend.questionSort dragover.questionSort dragenter.questionSort drop.questionSort');
        
        let draggedElement = null;
        let draggedQuestionId = null;

        $('.question-item').on('dragstart.questionSort', function(e) {
            if (hasResponses) {
                e.preventDefault();
                return;
            }
            
            draggedElement = this;
            draggedQuestionId = $(this).data('id');
            $(this).addClass('dragging');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/html', ''); // Chrome対応
        });

        $('.question-item').on('dragend.questionSort', function() {
            $(this).removeClass('dragging');
            $('.question-item').removeClass('drag-over');
            draggedElement = null;
            draggedQuestionId = null;
        });

        $('.question-item').on('dragover.questionSort', function(e) {
            if (hasResponses || !draggedElement || draggedElement === this) return;
            
            e.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'move';
            
            $('.question-item').removeClass('drag-over');
            $(this).addClass('drag-over');
        });

        $('.question-item').on('dragenter.questionSort', function(e) {
            if (hasResponses || !draggedElement || draggedElement === this) return;
            e.preventDefault();
        });

        $('.question-item').on('drop.questionSort', function(e) {
            if (hasResponses || !draggedElement || draggedElement === this) return;
            
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over');
            
            const targetQuestionId = $(this).data('id');
            const draggedIndex = questions.findIndex(q => q.id == draggedQuestionId);
            const targetIndex = questions.findIndex(q => q.id == targetQuestionId);
            
            console.log('Drop event:', {
                draggedQuestionId,
                targetQuestionId,
                draggedIndex,
                targetIndex
            });
            
            if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                // 配列から要素を移動
                const draggedQuestion = questions.splice(draggedIndex, 1)[0];
                questions.splice(targetIndex, 0, draggedQuestion);
                
                console.log('Questions reordered:', questions.map(q => ({ id: q.id, title: q.title })));
                
                // UIを再描画
                reorderQuestions();
                toastr.success('質問の順序を変更しました');
            }
        });
    }

    function newSurvey() {
        currentSurvey = {
            id: null,
            title: '',
            questions: [],
            published: false,
            publicUrl: null,
            createdAt: new Date().toISOString()
        };
        questions = [];
        hasResponses = false;
        
        $('#survey-title').val('');
        $('#publish-btn').text('公開');
        $('#drop-zone').empty();
        showDropZonePlaceholder();
        updateEditingRestrictions();
        
        toastr.info('新しいアンケートを開始しました');
    }

    // 新規作成ボタン（必要に応じて追加）
    $('body').append('<button id="new-survey-btn" class="btn btn-primary" style="position: fixed; bottom: 20px; right: 20px;">新規作成</button>');
    
    $('#new-survey-btn').on('click', function() {
        if (questions.length > 0 && !confirm('現在の編集内容が失われますが、よろしいですか？')) {
            return;
        }
        newSurvey();
    });

    // URL生成とコピー機能
    function generatePublicUrl(surveyId) {
        const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
        return `${baseUrl}survey.html?id=${surveyId}`;
    }

    // URLコピーボタンのイベント
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

    // 公開ページボタンのイベント
    $(document).on('click', '.view-public', function() {
        const url = $(this).data('url');
        window.open(url, '_blank');
    });

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