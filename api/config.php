<?php
// データベース設定 - JSONファイルを使用
define('SURVEYS_FILE', '../data/surveys.json');
define('RESPONSES_FILE', '../data/responses.json');

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// プリフライトリクエストへの対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Content-Type設定
header('Content-Type: application/json; charset=utf-8');

// エラーレポート設定
error_reporting(E_ALL);
ini_set('display_errors', 0);

// 共通関数
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

function sendError($message, $status = 400) {
    sendResponse(['error' => $message], $status);
}

function readJsonFile($filename) {
    if (!file_exists($filename)) {
        return [];
    }
    
    $content = file_get_contents($filename);
    if ($content === false) {
        throw new Exception("ファイルの読み込みに失敗しました: " . $filename);
    }
    
    $data = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSONの解析に失敗しました: " . json_last_error_msg());
    }
    
    return $data ?: [];
}

function writeJsonFile($filename, $data) {
    // ディレクトリが存在しない場合は作成
    $dir = dirname($filename);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            throw new Exception("ディレクトリの作成に失敗しました: " . $dir);
        }
    }
    
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        throw new Exception("JSONエンコードに失敗しました: " . json_last_error_msg());
    }
    
    if (file_put_contents($filename, $json, LOCK_EX) === false) {
        throw new Exception("ファイルの書き込みに失敗しました: " . $filename);
    }
    
    return true;
}

function validateSurvey($survey) {
    $errors = [];
    
    if (empty($survey['title'])) {
        $errors[] = "タイトルは必須です";
    }
    
    if (!isset($survey['questions']) || !is_array($survey['questions'])) {
        $errors[] = "質問は配列である必要があります";
    } else if (empty($survey['questions'])) {
        $errors[] = "最低1つの質問が必要です";
    }
    
    if (isset($survey['questions'])) {
        foreach ($survey['questions'] as $index => $question) {
            if (empty($question['title'])) {
                $errors[] = "質問" . ($index + 1) . "のタイトルは必須です";
            }
            
            if (empty($question['type'])) {
                $errors[] = "質問" . ($index + 1) . "のタイプは必須です";
            }
            
            $validTypes = ['text', 'email', 'textarea', 'radio', 'checkbox', 'select', 'label', 'parameter'];
            if (isset($question['type']) && !in_array($question['type'], $validTypes)) {
                $errors[] = "質問" . ($index + 1) . "のタイプが無効です";
            }
            
            if (in_array($question['type'], ['radio', 'checkbox', 'select'])) {
                if (!isset($question['options']) || !is_array($question['options']) || empty($question['options'])) {
                    $errors[] = "質問" . ($index + 1) . "には選択肢が必要です";
                }
            }
            
            // ラベルタイプとパラメータタイプは必須設定不可
            if (($question['type'] === 'label' || $question['type'] === 'parameter') && isset($question['required']) && $question['required']) {
                $errors[] = "質問" . ($index + 1) . "は" . ($question['type'] === 'label' ? 'ラベル' : 'パラメータ') . "タイプのため必須設定できません";
            }
            
            // パラメータタイプはパラメータ名が必須
            if ($question['type'] === 'parameter') {
                if (!isset($question['parameterName']) || empty(trim($question['parameterName']))) {
                    $errors[] = "質問" . ($index + 1) . "のパラメータ名は必須です";
                }
            }
            
            // 条件分岐のバリデーション
            if (isset($question['conditions']) && is_array($question['conditions'])) {
                foreach ($question['conditions'] as $condIndex => $condition) {
                    if (!isset($condition['targetQuestionId'])) {
                        $errors[] = "質問" . ($index + 1) . "の条件" . ($condIndex + 1) . "に対象質問IDが必要です";
                    }
                    
                    if (!isset($condition['operator'])) {
                        $errors[] = "質問" . ($index + 1) . "の条件" . ($condIndex + 1) . "に演算子が必要です";
                    } else {
                        $validOperators = ['equals', 'contains', 'not_equals'];
                        if (!in_array($condition['operator'], $validOperators)) {
                            $errors[] = "質問" . ($index + 1) . "の条件" . ($condIndex + 1) . "の演算子が無効です";
                        }
                    }
                    
                    if (!isset($condition['value'])) {
                        $errors[] = "質問" . ($index + 1) . "の条件" . ($condIndex + 1) . "に値が必要です";
                    }
                }
            }
        }
    }
    
    return $errors;
}

function generateId() {
    return time() . mt_rand(1000, 9999);
}
?>