// The Roblox executor script served at /api/public/script.lua so the user can run
// loadstring(game:HttpGet(".../api/public/script.lua"))() instead of copy-pasting.
// It uses game:HttpGet first (returns the body directly, no status-code checks),
// and falls back to the executor's request() function.
export function robloxScript(baseUrl: string): string {
  return `-- SAB Riddle Solver + Sammy Admin Abuse notes
-- Load with: loadstring(game:HttpGet("${baseUrl}/api/public/script.lua"))()
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local TextChatService = game:GetService("TextChatService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local G = (getgenv and getgenv()) or _G
local BASE_URL = "${baseUrl}"
local SOLVE_URL = BASE_URL .. "/api/public/solve"
local NOTES_URL = BASE_URL .. "/api/public/aa-notes"

local rawRequest = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)

-- Turn any reply text into a Lua table (or nil). Never errors.
local function decode(body)
    if type(body) ~= "string" or body == "" then return nil end
    if string.sub(body, 1, 1) ~= "{" then return nil end
    local ok, data = pcall(function() return HttpService:JSONDecode(body) end)
    if ok and type(data) == "table" then return data end
    return nil
end

-- GET a URL and return the decoded JSON. Tries game:HttpGet, then request().
local function getJson(url)
    local ok, body = pcall(function() return game:HttpGet(url, true) end)
    if ok then
        local data = decode(body)
        if data then return data end
    end
    if rawRequest then
        local ok2, res = pcall(function() return rawRequest({ Url = url, Method = "GET" }) end)
        if ok2 and type(res) == "table" then
            local data = decode(res.Body or res.body)
            if data then return data end
        end
    end
    return nil
end

-- ============================================================
-- AI BUTTON: G.setAIToggle(true) = ON, G.setAIToggle(false) = OFF
-- ============================================================
if G.AI_ENABLED == nil then G.AI_ENABLED = false end
G.setAIToggle = function(state)
    G.AI_ENABLED = state and true or false
    print("[AI Solver] " .. (G.AI_ENABLED and "ON (listening)" or "OFF"))
end

-- ============================================================
-- REDEEM ANSWER IN-GAME
-- ============================================================
local function redeemAnswer(code)
    print("[AI Solver] Redeeming: " .. tostring(code))
    pcall(function()
        local remote = ReplicatedStorage:FindFirstChild("RedeemCode", true)
            or ReplicatedStorage:FindFirstChild("ClaimCode", true)
            or ReplicatedStorage:FindFirstChild("EnterCode", true)
        if remote and remote:IsA("RemoteEvent") then
            remote:FireServer(code)
        elseif remote and remote:IsA("RemoteFunction") then
            remote:InvokeServer(code)
        end
    end)
    pcall(function()
        if TextChatService.ChatVersion == Enum.ChatVersion.TextChatService then
            local ch = TextChatService.TextChannels:FindFirstChild("RBXGeneral")
            if ch then ch:SendAsync(code) end
        else
            ReplicatedStorage.DefaultChatSystemChatEvents.SayMessageRequest:FireServer(code, "All")
        end
    end)
end

-- ============================================================
-- SOLVE A RIDDLE (returns the code, or nil)
-- ============================================================
G.solveRiddle = function(riddleText)
    local url = SOLVE_URL .. "?riddle=" .. HttpService:UrlEncode(riddleText)
        .. "&mode=" .. HttpService:UrlEncode(tostring(G.AI_SPEED_MODE or "faster"))
    local data = getJson(url)
    if data and data.answer then return tostring(data.answer) end
    warn("[AI Solver] No answer: " .. tostring(data and data.error or "no reply"))
    return nil
end

local function handleRiddle(riddleText)
    print("[AI Solver] Riddle: " .. riddleText)
    task.spawn(function()
        local code = G.solveRiddle(riddleText)
        if code then
            print("[AI Solver] Answer: " .. code)
            redeemAnswer(code)
        end
    end)
end

-- ============================================================
-- SAVE SAMMY'S UPDATES
-- ============================================================
local function saveSammyNote(text)
    task.spawn(function()
        local data = getJson(NOTES_URL .. "?message=" .. HttpService:UrlEncode(string.sub(text, 1, 1000)))
        if data and data.saved then
            print("[AA-Notes] Saved: " .. text)
        else
            warn("[AA-Notes] Not saved: " .. tostring(data and data.error or "no reply"))
        end
    end)
end

-- ============================================================
-- CHAT LISTENER (only works while the AI button is ON)
-- ============================================================
local seen = {}
local function onChat(senderName, messageText)
    if not G.AI_ENABLED then return end
    if type(messageText) ~= "string" or messageText == "" then return end
    local sender = string.lower(senderName or "")
    if not (sender == "spydersammy" or string.find(sender, "sammy", 1, true)) then return end
    if seen[messageText] then return end
    seen[messageText] = true

    local t = string.lower(messageText)
    if string.find(t, "riddle", 1, true) or string.find(t, "what my", 1, true)
        or string.find(t, "what is", 1, true) or string.find(t, "who is", 1, true)
        or string.find(t, "+", 1, true) then
        handleRiddle(messageText)
    else
        saveSammyNote(messageText)
    end
end

if not G.__SAB_SOLVER_HOOKED then
    G.__SAB_SOLVER_HOOKED = true
    if TextChatService.ChatVersion == Enum.ChatVersion.TextChatService then
        TextChatService.MessageReceived:Connect(function(msg)
            if msg.TextSource then
                local p = Players:GetPlayerByUserId(msg.TextSource.UserId)
                if p then G.__SAB_ONCHAT(p.Name, msg.Text) end
            end
        end)
    else
        local function hook(p)
            p.Chatted:Connect(function(m) G.__SAB_ONCHAT(p.Name, m) end)
        end
        for _, p in ipairs(Players:GetPlayers()) do hook(p) end
        Players.PlayerAdded:Connect(hook)
    end
end
G.__SAB_ONCHAT = onChat

-- ============================================================
-- SPEED: "faster" = fastest Google search AI, "fast" = smarter Google search AI
-- ============================================================
if G.AI_SPEED_MODE == nil then G.AI_SPEED_MODE = "faster" end
G.setAISpeed = function(mode)
    if mode == "faster" or mode == "fast" then
        G.AI_SPEED_MODE = mode
        print("[AI Solver] Speed: " .. mode)
    end
end

print("[AI Solver] Ready! Turn on with setAIToggle(true)")
`;
}
