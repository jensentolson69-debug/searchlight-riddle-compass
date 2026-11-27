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
local CONFIRM_URL = BASE_URL .. "/api/public/confirm-riddle"
local pending = {}

local rawRequest = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)

-- Turn any reply text into a Lua table (or nil). Never errors.
local function decode(body)
    if type(body) ~= "string" or body == "" then return nil end
    body = body:gsub("^%s+", "")
    if string.sub(body, 1, 1) ~= "{" then return nil end
    local ok, data = pcall(function() return HttpService:JSONDecode(body) end)
    if ok and type(data) == "table" then return data end
    return nil
end

-- GET a URL and return the decoded JSON. Tries game:HttpGet, then request().
local function getJson(url)
    url = url .. (string.find(url, "?", 1, true) and "&" or "?") .. "_t=" .. tostring(os.time()) .. tostring(math.random(1000, 9999))
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

-- Call this ONLY when Roblox reports that the code was successfully redeemed.
-- A sent request, typed code, or HTTP 200 is not proof of a correct riddle.
G.confirmRiddle = function(code, redeemed)
    if redeemed ~= true then return false end
    local ticket = pending[tostring(code)]
    if not ticket then return false end
    local result = getJson(CONFIRM_URL .. "?redeemed=true&confirmation=" .. HttpService:UrlEncode(ticket))
    if result and result.saved == true then
        pending[tostring(code)] = nil
        print("[AI Solver] Correct answer saved for faster future riddles")
        return true
    end
    warn("[AI Solver] Could not save correct answer: " .. tostring(result and result.error or "no reply"))
    return false
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
    local ok, result = pcall(function()
        local remote = ReplicatedStorage:FindFirstChild("RedeemCode", true)
            or ReplicatedStorage:FindFirstChild("ClaimCode", true)
            or ReplicatedStorage:FindFirstChild("EnterCode", true)
        if remote and remote:IsA("RemoteEvent") then
            remote:FireServer(code)
            return nil
        elseif remote and remote:IsA("RemoteFunction") then
            return remote:InvokeServer(code)
        end
        if TextChatService.ChatVersion == Enum.ChatVersion.TextChatService then
            local ch = TextChatService.TextChannels:FindFirstChild("RBXGeneral")
            if ch then ch:SendAsync(code) end
        else
            ReplicatedStorage.DefaultChatSystemChatEvents.SayMessageRequest:FireServer(code, "All")
        end
    end)
    -- Only explicit success from the game counts, never pcall success alone.
    return ok and type(result) == "table" and (result.success == true or result.Success == true)
end

-- ============================================================
-- WATCH FOR A BRAINROT SPAWN (confirms the riddle was right)
-- ============================================================
local function isOwnedByLocalPlayer(inst, lp)
    local cur = inst
    local depth = 0
    while cur and cur ~= workspace and cur ~= game and depth < 8 do
        depth = depth + 1
        local name = string.lower(cur.Name)
        if name == string.lower(lp.Name) or string.find(name, string.lower(lp.Name), 1, true) then
            return true
        end
        local okAttr, owner = pcall(function()
            return cur:GetAttribute("Owner") or cur:GetAttribute("OwnerName") or cur:GetAttribute("Player")
                or cur:GetAttribute("OwnerId") or cur:GetAttribute("UserId")
        end)
        if okAttr and owner ~= nil then
            if owner == lp.Name or owner == lp.UserId or tostring(owner) == tostring(lp.UserId) then
                return true
            end
        end
        local ownerVal = cur:FindFirstChild("Owner") or cur:FindFirstChild("OwnerId") or cur:FindFirstChild("Player")
        if ownerVal and ownerVal:IsA("ValueBase") then
            local v = ownerVal.Value
            if v == lp or v == lp.Name or v == lp.UserId then
                return true
            end
        end
        cur = cur.Parent
    end
    return false
end

local function looksLikeBrainrotModel(inst, lp)
    if not inst:IsA("Model") then return false end
    if Players:GetPlayerFromCharacter(inst) then return false end
    if isOwnedByLocalPlayer(inst, lp) then return true end
    local okAttr, hasBrainrotAttr = pcall(function()
        return inst:GetAttribute("Rarity") ~= nil
            or inst:GetAttribute("Mutation") ~= nil
            or inst:GetAttribute("Income") ~= nil
            or inst:GetAttribute("Generation") ~= nil
            or inst:GetAttribute("Brainrot") ~= nil
    end)
    if okAttr and hasBrainrotAttr then return true end
    local parentName = inst.Parent and string.lower(inst.Parent.Name) or ""
    if string.find(parentName, "brainrot", 1, true)
        or string.find(parentName, "animal", 1, true)
        or string.find(parentName, "spawn", 1, true)
        or string.find(parentName, "podium", 1, true)
        or string.find(parentName, "plot", 1, true) then
        return true
    end
    return false
end

local function watchForBrainrotSpawn(code, timeoutSeconds)
    local lp = Players.LocalPlayer
    if not lp then return end
    local conns = {}
    local confirmed = false

    local function cleanup()
        for _, c in ipairs(conns) do
            pcall(function() c:Disconnect() end)
        end
        conns = {}
    end

    local function confirm(reason)
        if confirmed then return end
        confirmed = true
        cleanup()
        print("[AI Solver] Confirmed (" .. reason .. "), saving answer to database...")
        task.spawn(function() G.confirmRiddle(code, true) end)
    end

    table.insert(conns, workspace.DescendantAdded:Connect(function(inst)
        if confirmed then return end
        if looksLikeBrainrotModel(inst, lp) then
            confirm("brainrot spawned: " .. inst.Name)
        end
    end))

    local backpack = lp:FindFirstChildOfClass("Backpack")
    if backpack then
        table.insert(conns, backpack.ChildAdded:Connect(function(inst)
            if not confirmed and inst:IsA("Tool") then
                confirm("tool received: " .. inst.Name)
            end
        end))
    end

    local pg = lp:FindFirstChildOfClass("PlayerGui")
    if pg then
        table.insert(conns, pg.DescendantAdded:Connect(function(inst)
            if confirmed then return end
            if not (inst:IsA("TextLabel") or inst:IsA("TextButton")) then return end
            local ok, text = pcall(function() return string.lower(inst.Text or "") end)
            if not ok or text == "" then return end
            if string.find(text, "wrong", 1, true)
                or string.find(text, "invalid", 1, true)
                or string.find(text, "expired", 1, true)
                or string.find(text, "already", 1, true)
                or string.find(text, "fail", 1, true)
                or string.find(text, "incorrect", 1, true) then
                return
            end
            if string.find(text, "redeem", 1, true)
                or string.find(text, "spawned", 1, true)
                or string.find(text, "correct", 1, true)
                or string.find(text, "claimed", 1, true)
                or string.find(text, "unlocked", 1, true) then
                confirm("game notification")
            end
        end))
    end

    task.delay(timeoutSeconds or 8, cleanup)
end

-- ============================================================
-- SOLVE A RIDDLE (returns the code, or nil)
-- ============================================================
G.solveRiddle = function(riddleText)
    local url = SOLVE_URL .. "?riddle=" .. HttpService:UrlEncode(riddleText)
        .. "&mode=" .. HttpService:UrlEncode(tostring(G.AI_SPEED_MODE or "faster"))
    local data = getJson(url)
    if data and data.success ~= false then
        local code = data.answer or data.code or data.result or data.response
        if type(code) == "string" and code ~= "" then
            if type(data.confirmation) == "string" then pending[code] = data.confirmation end
            return code
        end
    end
    warn("[AI Solver] No answer: " .. tostring(data and data.error or "no reply"))
    return nil
end

local function handleRiddle(riddleText)
    print("[AI Solver] Riddle: " .. riddleText)
    task.spawn(function()
        local code = G.solveRiddle(riddleText)
        if code then
            print("[AI Solver] Answer: " .. code)
            if redeemAnswer(code) then
                G.confirmRiddle(code, true)
            else
                watchForBrainrotSpawn(code, 8)
            end
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
    if sender ~= "spydersammy" then return end
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
-- Speed setting is script-only. Both models still double-check in parallel.
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
