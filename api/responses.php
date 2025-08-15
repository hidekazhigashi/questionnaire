<?php
require_once 'config.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            handleGetResponses();
            break;
        case 'POST':
            handleCreateResponse();
            break;
        case 'DELETE':
            handleDeleteResponse();
            break;
        default:
            sendError('サポートされていないメソッドです', 405);
    }
} catch (Exception $e) {
    sendError('サーバーエラー: ' . $e->getMessage(), 500);
}

function handleGetResponses() {
    $responses = readJsonFile(RESPONSES_FILE);
    
    // 特定のアンケートIDが指定されている場合
    if (isset($_GET['surveyId'])) {
        $surveyId = intval($_GET['surveyId']);
        $responses = array_filter($responses, function($r) use ($surveyId) {
            return $r['surveyId'] == $surveyId;
        });
    }
    
    // 統計情報が要求されている場合
    if (isset($_GET['stats']) && $_GET['stats'] === 'true') {
        $stats = generateResponseStats($responses);
        sendResponse($stats);
    }
    
    sendResponse(array_values($responses));
}

function handleCreateResponse() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null) {
        sendError('無効なJSONデータです');
    }
    
    // バリデーション
    $errors = validateResponse($input);
    if (!empty($errors)) {
        sendError('バリデーションエラー: ' . implode(', ', $errors));
    }
    
    // アンケートが存在し、公開されているかチェック
    $surveys = readJsonFile(SURVEYS_FILE);
    $survey = null;
    foreach ($surveys as $s) {
        if ($s['id'] == $input['surveyId']) {
            $survey = $s;
            break;
        }
    }
    
    if (!$survey) {
        sendError('アンケートが見つかりません', 404);
    }
    
    if (!$survey['published']) {
        sendError('このアンケートは現在公開されていません', 403);
    }
    
    // 回答データの詳細バリデーション
    $validationErrors = validateResponseAgainstSurvey($input, $survey);
    if (!empty($validationErrors)) {
        sendError('回答バリデーションエラー: ' . implode(', ', $validationErrors));
    }
    
    $responses = readJsonFile(RESPONSES_FILE);
    
    // 新しい回答を作成
    $response = [
        'id' => generateId(),
        'surveyId' => $input['surveyId'],
        'surveyTitle' => $survey['title'],
        'answers' => $input['answers'],
        'submittedAt' => date('c'),
        'ipAddress' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ];
    
    $responses[] = $response;
    writeJsonFile(RESPONSES_FILE, $responses);
    
    sendResponse($response, 201);
}

function handleDeleteResponse() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null || !isset($input['id'])) {
        sendError('IDが指定されていません');
    }
    
    $responses = readJsonFile(RESPONSES_FILE);
    $responseIndex = -1;
    
    // 削除する回答を検索
    foreach ($responses as $index => $response) {
        if ($response['id'] == $input['id']) {
            $responseIndex = $index;
            break;
        }
    }
    
    if ($responseIndex === -1) {
        sendError('回答が見つかりません', 404);
    }
    
    // 回答を削除
    array_splice($responses, $responseIndex, 1);
    writeJsonFile(RESPONSES_FILE, $responses);
    
    sendResponse(['message' => '回答が削除されました']);
}

function validateResponse($response) {
    $errors = [];
    
    if (!isset($response['surveyId']) || !is_numeric($response['surveyId'])) {
        $errors[] = "アンケートIDは必須です";
    }
    
    if (!isset($response['answers']) || !is_array($response['answers'])) {
        $errors[] = "回答は配列である必要があります";
    }
    
    return $errors;
}

function validateResponseAgainstSurvey($response, $survey) {
    $errors = [];
    $answers = $response['answers'];
    
    foreach ($survey['questions'] as $index => $question) {
        $questionName = "question_$index";
        $answer = isset($answers[$questionName]) ? $answers[$questionName] : null;
        
        // 条件分岐による表示チェック
        $shouldShow = evaluateQuestionConditions($question, $answers, $survey['questions']);
        
        // 非表示の質問はバリデーション対象外
        if (!$shouldShow) {
            continue;
        }
        
        // 必須質問のチェック（表示されている場合のみ）
        if (isset($question['required']) && $question['required']) {
            if ($question['type'] === 'checkbox') {
                if (!is_array($answer) || empty($answer)) {
                    $errors[] = "質問「{$question['title']}」は必須です";
                }
            } else {
                if (empty($answer)) {
                    $errors[] = "質問「{$question['title']}」は必須です";
                }
            }
        }
        
        // 選択肢の妥当性チェック
        if (in_array($question['type'], ['radio', 'checkbox', 'select']) && !empty($answer)) {
            $validOptions = $question['options'];
            
            if ($question['type'] === 'checkbox') {
                if (is_array($answer)) {
                    foreach ($answer as $selectedOption) {
                        if (!in_array($selectedOption, $validOptions)) {
                            $errors[] = "質問「{$question['title']}」の選択肢が無効です: $selectedOption";
                        }
                    }
                }
            } else {
                if (!in_array($answer, $validOptions)) {
                    $errors[] = "質問「{$question['title']}」の選択肢が無効です: $answer";
                }
            }
        }
    }
    
    return $errors;
}

function evaluateQuestionConditions($question, $answers, $allQuestions) {
    // 条件がない場合は常に表示
    if (!isset($question['conditions']) || empty($question['conditions'])) {
        return true;
    }
    
    // すべての条件がANDで結合される
    foreach ($question['conditions'] as $condition) {
        if (!evaluateCondition($condition, $answers, $allQuestions)) {
            return false;
        }
    }
    
    return true;
}

function evaluateCondition($condition, $answers, $allQuestions) {
    $targetQuestionId = $condition['targetQuestionId'];
    $operator = $condition['operator'];
    $expectedValue = $condition['value'];
    
    // 対象質問のインデックスを見つける
    $targetQuestionIndex = null;
    foreach ($allQuestions as $index => $q) {
        if ($q['id'] == $targetQuestionId) {
            $targetQuestionIndex = $index;
            break;
        }
    }
    
    if ($targetQuestionIndex === null) {
        return false; // 対象質問が見つからない場合は非表示
    }
    
    $targetQuestionName = "question_$targetQuestionIndex";
    $actualValue = isset($answers[$targetQuestionName]) ? $answers[$targetQuestionName] : null;
    
    switch ($operator) {
        case 'equals':
            if (is_array($actualValue)) {
                return in_array($expectedValue, $actualValue);
            }
            return $actualValue === $expectedValue;
            
        case 'contains':
            if (is_array($actualValue)) {
                foreach ($actualValue as $val) {
                    if (strpos($val, $expectedValue) !== false) {
                        return true;
                    }
                }
                return false;
            }
            return $actualValue && strpos($actualValue, $expectedValue) !== false;
            
        case 'not_equals':
            if (is_array($actualValue)) {
                return !in_array($expectedValue, $actualValue);
            }
            return $actualValue !== $expectedValue;
            
        default:
            return false;
    }
}

function generateResponseStats($responses) {
    $stats = [
        'totalResponses' => count($responses),
        'responsesPerSurvey' => [],
        'responsesByDate' => []
    ];
    
    // アンケートごとの回答数
    foreach ($responses as $response) {
        $surveyId = $response['surveyId'];
        if (!isset($stats['responsesPerSurvey'][$surveyId])) {
            $stats['responsesPerSurvey'][$surveyId] = 0;
        }
        $stats['responsesPerSurvey'][$surveyId]++;
    }
    
    // 日付ごとの回答数
    foreach ($responses as $response) {
        $date = date('Y-m-d', strtotime($response['submittedAt']));
        if (!isset($stats['responsesByDate'][$date])) {
            $stats['responsesByDate'][$date] = 0;
        }
        $stats['responsesByDate'][$date]++;
    }
    
    return $stats;
}
?>