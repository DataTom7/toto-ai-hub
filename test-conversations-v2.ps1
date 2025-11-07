# Simulate 10 diverse user conversations with CaseAgent
# This script tests various scenarios including the affirmative response fix and other edge cases
# Run with: .\test-conversations-v2.ps1

$baseUrl = "http://localhost:8080/api/case"
$results = @()
$conversationIdCounter = 1

# Helper function to send message with proper conversation context
function Send-Message {
    param(
        [string]$message,
        [hashtable]$caseData,
        [string]$conversationId,
        [string]$userId = "test-user"
    )
    
    $body = @{
        message = $message
        caseData = $caseData
        userContext = @{
            userId = $userId
            userRole = "user"
            language = "es"
            platform = "web"
            name = "Usuario Prueba"
        }
        conversationContext = @{
            conversationId = $conversationId
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType 'application/json'
        return $response
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return @{
            success = $false
            error = $_.Exception.Message
            message = "Error: $($_.Exception.Message)"
        }
    }
}

# Helper to wait between messages (simulate real conversation timing)
function Wait-Conversation {
    param([int]$seconds = 1)
    Start-Sleep -Seconds $seconds
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Starting 10 Conversation Simulations" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================
# Conversation 1: Test affirmative response loop (the bug we just fixed)
# ============================================
Write-Host "`n=== Conversation 1: Affirmative Response Loop Test ===" -ForegroundColor Yellow
$conv1Id = "conv-1-affirmative-test"
$case1 = @{
    id = "nina-case-1"
    name = "Nina"
    description = "Nina es una perrita mayor con una condición cardíaca que necesita tratamiento médico continuo y medicación especial."
    status = "active"
    animalType = "dog"
    location = "Rosario"
    guardianName = "Diego Martinez"
    guardianBankingAlias = "diego.martinez.rescate"
}

$r1 = Send-Message -message "¡Hola! Te presento a Nina. Nina es una perrita mayor con una condición cardíaca que necesita tratamiento médico continuo y medicación especial. ¿Te gustaría ayudar a Nina?" -caseData $case1 -conversationId $conv1Id
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "Si, claro." -caseData $case1 -conversationId $conv1Id
Write-Host "User: Si, claro." -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r3 = Send-Message -message "Si." -caseData $case1 -conversationId $conv1Id
Write-Host "User: Si." -ForegroundColor Green
Write-Host "Agent: $($r3.message.Substring(0, [Math]::Min(150, $r3.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r4 = Send-Message -message "Si." -caseData $case1 -conversationId $conv1Id
Write-Host "User: Si." -ForegroundColor Green
Write-Host "Agent: $($r4.message.Substring(0, [Math]::Min(150, $r4.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 1
    scenario = "Affirmative Response Loop Test (Bug Fix Verification)"
    conversationId = $conv1Id
    messages = @(
        @{role='user'; content='¡Hola! Te presento a Nina...'; response=$r1.message},
        @{role='user'; content='Si, claro.'; response=$r2.message},
        @{role='user'; content='Si.'; response=$r3.message},
        @{role='user'; content='Si.'; response=$r4.message}
    )
    analysis = "Check if agent progresses conversation instead of repeating case info"
}

# ============================================
# Conversation 2: User asks vague questions
# ============================================
Write-Host "`n=== Conversation 2: Vague Questions ===" -ForegroundColor Yellow
$conv2Id = "conv-2-vague-questions"
$case2 = @{
    id = "max-case-2"
    name = "Max"
    description = "Max es un gato que necesita cirugía urgente de cadera."
    status = "urgent"
    animalType = "cat"
    location = "Buenos Aires"
    guardianName = "Ana López"
    guardianBankingAlias = "ana.lopez.rescate"
    targetAmount = 50000
    currentAmount = 15000
}

$r1 = Send-Message -message "Hola" -caseData $case2 -conversationId $conv2Id
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿Qué puedo hacer?" -caseData $case2 -conversationId $conv2Id
Write-Host "User: ¿Qué puedo hacer?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r3 = Send-Message -message "No sé, dime algo" -caseData $case2 -conversationId $conv2Id
Write-Host "User: No sé, dime algo" -ForegroundColor Green
Write-Host "Agent: $($r3.message.Substring(0, [Math]::Min(150, $r3.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 2
    scenario = "Vague Questions - User needs guidance"
    conversationId = $conv2Id
    messages = @(
        @{role='user'; content='Hola'; response=$r1.message},
        @{role='user'; content='¿Qué puedo hacer?'; response=$r2.message},
        @{role='user'; content='No sé, dime algo'; response=$r3.message}
    )
    analysis = "Check if agent provides clear guidance and actionable options"
}

# ============================================
# Conversation 3: Emotional user - worried about animal
# ============================================
Write-Host "`n=== Conversation 3: Emotional User (Worried) ===" -ForegroundColor Yellow
$conv3Id = "conv-3-emotional-worried"
$case3 = @{
    id = "luna-case-3"
    name = "Luna"
    description = "Luna fue encontrada en la calle con heridas graves. Necesita cirugía inmediata."
    status = "urgent"
    animalType = "dog"
    location = "Córdoba"
    guardianName = "Carlos Rodríguez"
    guardianBankingAlias = "carlos.rodriguez.rescate"
}

$r1 = Send-Message -message "Estoy muy preocupado por Luna. ¿Está bien? ¿Va a sobrevivir?" -caseData $case3 -conversationId $conv3Id
Write-Host "User: Estoy muy preocupado por Luna. ¿Está bien? ¿Va a sobrevivir?" -ForegroundColor Green
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿Cómo puedo ayudar urgentemente?" -caseData $case3 -conversationId $conv3Id
Write-Host "User: ¿Cómo puedo ayudar urgentemente?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 3
    scenario = "Emotional User - Worried about animal"
    conversationId = $conv3Id
    messages = @(
        @{role='user'; content='Estoy muy preocupado por Luna...'; response=$r1.message},
        @{role='user'; content='¿Cómo puedo ayudar urgentemente?'; response=$r2.message}
    )
    analysis = "Check if agent shows empathy and provides urgent action options"
}

# ============================================
# Conversation 4: User wants to know everything at once
# ============================================
Write-Host "`n=== Conversation 4: Information Overload Request ===" -ForegroundColor Yellow
$conv4Id = "conv-4-info-overload"
$case4 = @{
    id = "toby-case-4"
    name = "Toby"
    description = "Toby es un perro joven que necesita vacunación completa y esterilización."
    status = "active"
    animalType = "dog"
    location = "Rosario"
    guardianName = "María González"
    guardianBankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "Cuéntame todo sobre Toby: su historia, qué necesita, cómo donar, cómo adoptar, qué es TRF, cómo funcionan los Totitos, todo" -caseData $case4 -conversationId $conv4Id
Write-Host "User: Cuéntame todo sobre Toby..." -ForegroundColor Green
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(200, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "Ok pero no me quedó claro lo de las donaciones" -caseData $case4 -conversationId $conv4Id
Write-Host "User: Ok pero no me quedó claro lo de las donaciones" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 4
    scenario = "Information Overload Request"
    conversationId = $conv4Id
    messages = @(
        @{role='user'; content='Cuéntame todo sobre Toby...'; response=$r1.message},
        @{role='user'; content='Ok pero no me quedó claro lo de las donaciones'; response=$r2.message}
    )
    analysis = "Check if agent provides digestible information and can clarify specific points"
}

# ============================================
# Conversation 5: User changes topic mid-conversation
# ============================================
Write-Host "`n=== Conversation 5: Topic Change ===" -ForegroundColor Yellow
$conv5Id = "conv-5-topic-change"
$case5 = @{
    id = "bella-case-5"
    name = "Bella"
    description = "Bella necesita un hogar temporal mientras se recupera de una cirugía."
    status = "active"
    animalType = "dog"
    location = "Mendoza"
    guardianName = "Pedro Sánchez"
    guardianBankingAlias = "pedro.sanchez.rescate"
}

$r1 = Send-Message -message "Hola, quiero saber sobre Bella" -caseData $case5 -conversationId $conv5Id
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿Cómo funciona la adopción?" -caseData $case5 -conversationId $conv5Id
Write-Host "User: ¿Cómo funciona la adopción?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r3 = Send-Message -message "Ah, pero en realidad quiero donar, no adoptar" -caseData $case5 -conversationId $conv5Id
Write-Host "User: Ah, pero en realidad quiero donar, no adoptar" -ForegroundColor Green
Write-Host "Agent: $($r3.message.Substring(0, [Math]::Min(150, $r3.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 5
    scenario = "Topic Change - User changes mind"
    conversationId = $conv5Id
    messages = @(
        @{role='user'; content='Hola, quiero saber sobre Bella'; response=$r1.message},
        @{role='user'; content='¿Cómo funciona la adopción?'; response=$r2.message},
        @{role='user'; content='Ah, pero en realidad quiero donar, no adoptar'; response=$r3.message}
    )
    analysis = "Check if agent adapts smoothly to topic changes"
}

# ============================================
# Conversation 6: User asks about case that's already funded
# ============================================
Write-Host "`n=== Conversation 6: Fully Funded Case ===" -ForegroundColor Yellow
$conv6Id = "conv-6-fully-funded"
$case6 = @{
    id = "rocky-case-6"
    name = "Rocky"
    description = "Rocky ya recibió todo el tratamiento necesario."
    status = "completed"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "Laura Fernández"
    guardianBankingAlias = "laura.fernandez.rescate"
    targetAmount = 30000
    currentAmount = 35000
}

$r1 = Send-Message -message "Quiero donar a Rocky" -caseData $case6 -conversationId $conv6Id
Write-Host "User: Quiero donar a Rocky" -ForegroundColor Green
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿Puedo donar de todas formas?" -caseData $case6 -conversationId $conv6Id
Write-Host "User: ¿Puedo donar de todas formas?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 6
    scenario = "Fully Funded Case"
    conversationId = $conv6Id
    messages = @(
        @{role='user'; content='Quiero donar a Rocky'; response=$r1.message},
        @{role='user'; content='¿Puedo donar de todas formas?'; response=$r2.message}
    )
    analysis = "Check if agent handles completed/fully-funded cases appropriately"
}

# ============================================
# Conversation 7: User with very short responses
# ============================================
Write-Host "`n=== Conversation 7: Minimal Responses ===" -ForegroundColor Yellow
$conv7Id = "conv-7-minimal-responses"
$case7 = @{
    id = "simba-case-7"
    name = "Simba"
    description = "Simba es un gato que necesita tratamiento para parásitos."
    status = "active"
    animalType = "cat"
    location = "La Plata"
    guardianName = "Juan Pérez"
    guardianBankingAlias = "juan.perez.rescate"
}

$r1 = Send-Message -message "Hola" -caseData $case7 -conversationId $conv7Id
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "Ok" -caseData $case7 -conversationId $conv7Id
Write-Host "User: Ok" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r3 = Send-Message -message "Donar" -caseData $case7 -conversationId $conv7Id
Write-Host "User: Donar" -ForegroundColor Green
Write-Host "Agent: $($r3.message.Substring(0, [Math]::Min(150, $r3.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r4 = Send-Message -message "Cómo" -caseData $case7 -conversationId $conv7Id
Write-Host "User: Cómo" -ForegroundColor Green
Write-Host "Agent: $($r4.message.Substring(0, [Math]::Min(150, $r4.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 7
    scenario = "Minimal Responses - Very short user messages"
    conversationId = $conv7Id
    messages = @(
        @{role='user'; content='Hola'; response=$r1.message},
        @{role='user'; content='Ok'; response=$r2.message},
        @{role='user'; content='Donar'; response=$r3.message},
        @{role='user'; content='Cómo'; response=$r4.message}
    )
    analysis = "Check if agent can handle very short, minimal responses and still progress conversation"
}

# ============================================
# Conversation 8: User asks technical questions
# ============================================
Write-Host "`n=== Conversation 8: Technical Questions ===" -ForegroundColor Yellow
$conv8Id = "conv-8-technical"
$case8 = @{
    id = "lola-case-8"
    name = "Lola"
    description = "Lola necesita cirugía de cadera."
    status = "active"
    animalType = "dog"
    location = "Córdoba"
    guardianName = "Ana Martínez"
    guardianBankingAlias = "ana.martinez.rescate"
}

$r1 = Send-Message -message "¿Cómo verifico que mi donación llegó? ¿Hay algún comprobante?" -caseData $case8 -conversationId $conv8Id
Write-Host "User: ¿Cómo verifico que mi donación llegó? ¿Hay algún comprobante?" -ForegroundColor Green
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿El dinero va directo al guardián o pasa por la plataforma?" -caseData $case8 -conversationId $conv8Id
Write-Host "User: ¿El dinero va directo al guardián o pasa por la plataforma?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 8
    scenario = "Technical Questions - Verification and process details"
    conversationId = $conv8Id
    messages = @(
        @{role='user'; content='¿Cómo verifico que mi donación llegó? ¿Hay algún comprobante?'; response=$r1.message},
        @{role='user'; content='¿El dinero va directo al guardián o pasa por la plataforma?'; response=$r2.message}
    )
    analysis = "Check if agent provides accurate technical information about donation process"
}

# ============================================
# Conversation 9: User asks about multiple ways to help
# ============================================
Write-Host "`n=== Conversation 9: Multiple Help Options ===" -ForegroundColor Yellow
$conv9Id = "conv-9-multiple-options"
$case9 = @{
    id = "chico-case-9"
    name = "Chico"
    description = "Chico está buscando un hogar permanente."
    status = "active"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "María González"
    guardianBankingAlias = "maria.gonzalez.rescate"
    guardianTwitter = "maria_rescate"
    guardianInstagram = "maria_rescate"
}

$r1 = Send-Message -message "Quiero ayudar a Chico pero no tengo mucho dinero. ¿Qué más puedo hacer?" -caseData $case9 -conversationId $conv9Id
Write-Host "User: Quiero ayudar a Chico pero no tengo mucho dinero. ¿Qué más puedo hacer?" -ForegroundColor Green
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿Compartir en redes sociales ayuda realmente?" -caseData $case9 -conversationId $conv9Id
Write-Host "User: ¿Compartir en redes sociales ayuda realmente?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 9
    scenario = "Multiple Help Options - User wants alternatives to donation"
    conversationId = $conv9Id
    messages = @(
        @{role='user'; content='Quiero ayudar a Chico pero no tengo mucho dinero...'; response=$r1.message},
        @{role='user'; content='¿Compartir en redes sociales ayuda realmente?'; response=$r2.message}
    )
    analysis = "Check if agent provides multiple ways to help beyond just donations"
}

# ============================================
# Conversation 10: User asks about case with missing information
# ============================================
Write-Host "`n=== Conversation 10: Missing Information ===" -ForegroundColor Yellow
$conv10Id = "conv-10-missing-info"
$case10 = @{
    id = "unknown-case-10"
    name = "Sin nombre"
    description = "Animal encontrado en la calle."
    status = "active"
    animalType = "unknown"
    location = ""
    guardianName = ""
    # guardianBankingAlias is missing
}

$r1 = Send-Message -message "Quiero ayudar a este caso" -caseData $case10 -conversationId $conv10Id
Write-Host "User: Quiero ayudar a este caso" -ForegroundColor Green
Write-Host "Agent: $($r1.message.Substring(0, [Math]::Min(150, $r1.message.Length)))..." -ForegroundColor Gray
Wait-Conversation

$r2 = Send-Message -message "¿Cómo dono si no hay alias?" -caseData $case10 -conversationId $conv10Id
Write-Host "User: ¿Cómo dono si no hay alias?" -ForegroundColor Green
Write-Host "Agent: $($r2.message.Substring(0, [Math]::Min(150, $r2.message.Length)))..." -ForegroundColor Gray

$results += @{
    conversation = 10
    scenario = "Missing Information - Incomplete case data"
    conversationId = $conv10Id
    messages = @(
        @{role='user'; content='Quiero ayudar a este caso'; response=$r1.message},
        @{role='user'; content='¿Cómo dono si no hay alias?'; response=$r2.message}
    )
    analysis = "Check if agent handles missing case information gracefully and offers alternatives"
}

# ============================================
# Save and display results
# ============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "All conversations completed!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Save results to JSON
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath "conversation-results-v2.json" -Encoding UTF8
Write-Host "Results saved to conversation-results-v2.json" -ForegroundColor Green

# Display summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
foreach ($result in $results) {
    Write-Host "`nConversation $($result.conversation): $($result.scenario)" -ForegroundColor Cyan
    Write-Host "  Analysis: $($result.analysis)" -ForegroundColor Gray
    Write-Host "  Messages: $($result.messages.Count)" -ForegroundColor Gray
    $lastResponse = $result.messages[-1].response
    if ($lastResponse) {
        Write-Host "  Last response: $($lastResponse.Substring(0, [Math]::Min(100, $lastResponse.Length)))..." -ForegroundColor DarkGray
    }
}

Write-Host "`n=== ANALYSIS CHECKLIST ===" -ForegroundColor Yellow
Write-Host "Review each conversation and check:" -ForegroundColor White
Write-Host "  ✓ Does agent progress conversation naturally?" -ForegroundColor White
Write-Host "  ✓ Does agent avoid repeating same information?" -ForegroundColor White
Write-Host "  ✓ Does agent handle edge cases gracefully?" -ForegroundColor White
Write-Host "  ✓ Does agent provide actionable next steps?" -ForegroundColor White
Write-Host "  ✓ Does agent show appropriate empathy?" -ForegroundColor White
Write-Host "  ✓ Does agent provide accurate information?" -ForegroundColor White
Write-Host "  ✓ Does agent handle missing information correctly?" -ForegroundColor White
Write-Host "  ✓ Does agent adapt to user's communication style?" -ForegroundColor White

