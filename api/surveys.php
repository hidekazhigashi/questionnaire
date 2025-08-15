<?php
require_once 'config.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            handleGetSurveys();
            break;
        case 'POST':
            handleCreateSurvey();
            break;
        case 'PUT':
            handleUpdateSurvey();
            break;
        case 'DELETE':
            handleDeleteSurvey();
            break;
        default:
            sendError('サポートされていないメソッドです', 405);
    }
} catch (Exception $e) {
    sendError('サーバーエラー: ' . $e->getMessage(), 500);
}

function handleGetSurveys() {
    $surveys = readJsonFile(SURVEYS_FILE);
    
    // 特定のIDが指定されている場合
    if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $survey = array_filter($surveys, function($s) use ($id) {
            return $s['id'] == $id;
        });
        
        if (empty($survey)) {
            sendError('アンケートが見つかりません', 404);
        }
        
        sendResponse(array_values($survey)[0]);
    }
    
    // 公開されているアンケートのみを取得する場合
    if (isset($_GET['published']) && $_GET['published'] === 'true') {
        $surveys = array_filter($surveys, function($s) {
            return isset($s['published']) && $s['published'] === true;
        });
    }
    
    sendResponse(array_values($surveys));
}

function handleCreateSurvey() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null) {
        sendError('無効なJSONデータです');
    }
    
    // バリデーション
    $errors = validateSurvey($input);
    if (!empty($errors)) {
        sendError('バリデーションエラー: ' . implode(', ', $errors));
    }
    
    $surveys = readJsonFile(SURVEYS_FILE);
    
    // 新しいアンケートを作成
    $survey = [
        'id' => generateId(),
        'title' => $input['title'],
        'questions' => $input['questions'],
        'published' => isset($input['published']) ? $input['published'] : false,
        'publicUrl' => null,
        'createdAt' => date('c'),
        'updatedAt' => date('c')
    ];
    
    // 公開URLを生成
    if ($survey['published']) {
        $survey['publicUrl'] = generatePublicUrl($survey['id']);
    }
    
    $surveys[] = $survey;
    writeJsonFile(SURVEYS_FILE, $surveys);
    
    sendResponse($survey, 201);
}

function handleUpdateSurvey() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null || !isset($input['id'])) {
        sendError('無効なJSONデータまたはIDが指定されていません');
    }
    
    // バリデーション
    $errors = validateSurvey($input);
    if (!empty($errors)) {
        sendError('バリデーションエラー: ' . implode(', ', $errors));
    }
    
    $surveys = readJsonFile(SURVEYS_FILE);
    $surveyIndex = -1;
    
    // 既存のアンケートを検索
    foreach ($surveys as $index => $survey) {
        if ($survey['id'] == $input['id']) {
            $surveyIndex = $index;
            break;
        }
    }
    
    if ($surveyIndex === -1) {
        sendError('アンケートが見つかりません', 404);
    }
    
    // アンケートを更新
    $existingSurvey = $surveys[$surveyIndex];
    $updatedSurvey = [
        'id' => $existingSurvey['id'],
        'title' => $input['title'],
        'questions' => $input['questions'],
        'published' => isset($input['published']) ? $input['published'] : $existingSurvey['published'],
        'publicUrl' => $existingSurvey['publicUrl'],
        'createdAt' => $existingSurvey['createdAt'],
        'updatedAt' => date('c')
    ];
    
    // 公開URLを生成または削除
    if ($updatedSurvey['published'] && !$updatedSurvey['publicUrl']) {
        $updatedSurvey['publicUrl'] = generatePublicUrl($updatedSurvey['id']);
    }
    
    $surveys[$surveyIndex] = $updatedSurvey;
    writeJsonFile(SURVEYS_FILE, $surveys);
    
    sendResponse($updatedSurvey);
}

function handleDeleteSurvey() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null || !isset($input['id'])) {
        sendError('IDが指定されていません');
    }
    
    $surveys = readJsonFile(SURVEYS_FILE);
    $surveyIndex = -1;
    
    // 削除するアンケートを検索
    foreach ($surveys as $index => $survey) {
        if ($survey['id'] == $input['id']) {
            $surveyIndex = $index;
            break;
        }
    }
    
    if ($surveyIndex === -1) {
        sendError('アンケートが見つかりません', 404);
    }
    
    // アンケートを削除
    array_splice($surveys, $surveyIndex, 1);
    writeJsonFile(SURVEYS_FILE, $surveys);
    
    // 関連する回答も削除
    try {
        $responses = readJsonFile(RESPONSES_FILE);
        $responses = array_filter($responses, function($r) use ($input) {
            return $r['surveyId'] != $input['id'];
        });
        writeJsonFile(RESPONSES_FILE, array_values($responses));
    } catch (Exception $e) {
        // 回答ファイルが存在しない場合は無視
    }
    
    sendResponse(['message' => 'アンケートが削除されました']);
}

function generatePublicUrl($surveyId) {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['REQUEST_URI']);
    $path = str_replace('/api', '', $path);
    
    return $protocol . '://' . $host . $path . '/survey.html?id=' . $surveyId;
}
?>