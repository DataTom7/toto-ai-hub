# Simulate 10 real user conversations with CaseAgent
# This script tests various user scenarios and collects responses for analysis

$baseUrl = "http://localhost:8080/api/case"
$results = @()

# Helper function to send message
function Send-Message {
    param(
        [string]$message,
        [hashtable]$caseData,
        [array]$conversationHistory = @()
    )
    
    $body = @{
        message = $message
        caseData = $caseData
        userContext = @{
            userId = "test-user"
            name = "Usuario Prueba"
        }
        conversationContext = @{
            messages = $conversationHistory
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType 'application/json'
        return $response
    } catch {
        return @{
            success = $false
            error = $_.Exception.Message
            message = "Error: $($_.Exception.Message)"
        }
    }
}

# Conversation 1: First-time donor wants to donate $50
Write-Host "`n=== Conversation 1: First-time donor wants to donate $50 ===" -ForegroundColor Cyan
$conv1 = @()
$case1 = @{
    id = "luna-case-1"
    name = "Luna"
    description = "Luna es una perrita callejera muy dulce que fue encontrada con la pata rota. Necesita atención médica inmediata y cirugía para poder caminar nuevamente."
    status = "active"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "María González"
    bankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "¡Hola! Vi el caso de Luna. Me gustaría ayudar." -caseData $case1
$conv1 += @{role='user'; content='¡Hola! Vi el caso de Luna. Me gustaría ayudar.'; timestamp='2024-01-01T10:00:00Z'}
$conv1 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "Quiero donar $50. ¿Cómo lo hago?" -caseData $case1 -conversationHistory $conv1
$conv1 += @{role='user'; content='Quiero donar $50. ¿Cómo lo hago?'; timestamp='2024-01-01T10:00:02Z'}
$conv1 += @{role='assistant'; content=$r2.message; timestamp='2024-01-01T10:00:03Z'}

$r3 = Send-Message -message "Perfecto, ya hice la transferencia. ¿Qué sigue?" -caseData $case1 -conversationHistory $conv1
$results += @{
    conversation = 1
    scenario = "First-time donor wants to donate $50"
    messages = $conv1
    finalResponse = $r3.message
}

# Conversation 2: User asks about minimum donation
Write-Host "`n=== Conversation 2: User asks about minimum donation ===" -ForegroundColor Cyan
$conv2 = @()
$case2 = @{
    id = "max-case-2"
    name = "Max"
    description = "Max es un gato adulto que necesita cirugía de esterilización y vacunación."
    status = "active"
    animalType = "cat"
    location = "Córdoba"
    guardianName = "Carlos Martínez"
    bankingAlias = "carlos.martinez.rescate"
}

$r1 = Send-Message -message "Hola, vi el caso de Max. ¿Cuál es el monto mínimo para donar?" -caseData $case2
$conv2 += @{role='user'; content='Hola, vi el caso de Max. ¿Cuál es el monto mínimo para donar?'; timestamp='2024-01-01T10:00:00Z'}
$conv2 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "Ok, entonces puedo donar $5?" -caseData $case2 -conversationHistory $conv2
$results += @{
    conversation = 2
    scenario = "User asks about minimum donation"
    messages = $conv2
    finalResponse = $r2.message
}

# Conversation 3: Case with missing banking alias
Write-Host "`n=== Conversation 3: Case with missing banking alias ===" -ForegroundColor Cyan
$conv3 = @()
$case3 = @{
    id = "bella-case-3"
    name = "Bella"
    description = "Bella necesita tratamiento médico urgente."
    status = "active"
    animalType = "dog"
    location = "Rosario"
    guardianName = "Ana López"
    # bankingAlias is missing
}

$r1 = Send-Message -message "Quiero donar $30 para ayudar a Bella." -caseData $case3
$conv3 += @{role='user'; content='Quiero donar $30 para ayudar a Bella.'; timestamp='2024-01-01T10:00:00Z'}
$conv3 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "¿Qué es el TRF? ¿Cómo funciona?" -caseData $case3 -conversationHistory $conv3
$results += @{
    conversation = 3
    scenario = "Case with missing banking alias"
    messages = $conv3
    finalResponse = $r2.message
}

# Conversation 4: User asks about transparency and verification
Write-Host "`n=== Conversation 4: User asks about transparency ===" -ForegroundColor Cyan
$conv4 = @()
$case4 = @{
    id = "rocky-case-4"
    name = "Rocky"
    description = "Rocky necesita cirugía de cadera."
    status = "active"
    animalType = "dog"
    location = "Mendoza"
    guardianName = "Pedro Sánchez"
    bankingAlias = "pedro.sanchez.rescate"
}

$r1 = Send-Message -message "Quiero donar pero me preocupa que el dinero llegue realmente al animal. ¿Cómo garantizan la transparencia?" -caseData $case4
$conv4 += @{role='user'; content='Quiero donar pero me preocupa que el dinero llegue realmente al animal. ¿Cómo garantizan la transparencia?'; timestamp='2024-01-01T10:00:00Z'}
$conv4 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "¿Puedo verificar mi donación después?" -caseData $case4 -conversationHistory $conv4
$results += @{
    conversation = 4
    scenario = "User asks about transparency and verification"
    messages = $conv4
    finalResponse = $r2.message
}

# Conversation 5: User asks what happens after donation
Write-Host "`n=== Conversation 5: User asks what happens after donation ===" -ForegroundColor Cyan
$conv5 = @()
$case5 = @{
    id = "lola-case-5"
    name = "Lola"
    description = "Lola necesita tratamiento para parásitos."
    status = "active"
    animalType = "dog"
    location = "La Plata"
    guardianName = "Laura Fernández"
    bankingAlias = "laura.fernandez.rescate"
}

$r1 = Send-Message -message "Acabo de donar $20. ¿Qué pasa ahora? ¿Recibiré actualizaciones?" -caseData $case5
$conv5 += @{role='user'; content='Acabo de donar $20. ¿Qué pasa ahora? ¿Recibiré actualizaciones?'; timestamp='2024-01-01T10:00:00Z'}
$conv5 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "¿Y si el caso alcanza la meta? ¿Qué pasa con mi donación?" -caseData $case5 -conversationHistory $conv5
$results += @{
    conversation = 5
    scenario = "User asks what happens after donation"
    messages = $conv5
    finalResponse = $r2.message
}

# Conversation 6: User asks about Totitos system
Write-Host "`n=== Conversation 6: User asks about Totitos ===" -ForegroundColor Cyan
$conv6 = @()
$case6 = @{
    id = "simba-case-6"
    name = "Simba"
    description = "Simba necesita vacunación completa."
    status = "active"
    animalType = "cat"
    location = "Buenos Aires"
    guardianName = "María González"
    bankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "Escuché que hay un sistema de recompensas. ¿Qué son los Totitos?" -caseData $case6
$conv6 += @{role='user'; content='Escuché que hay un sistema de recompensas. ¿Qué son los Totitos?'; timestamp='2024-01-01T10:00:00Z'}
$conv6 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "¿Cómo gano Totitos? ¿Qué puedo hacer con ellos?" -caseData $case6 -conversationHistory $conv6
$results += @{
    conversation = 6
    scenario = "User asks about Totitos system"
    messages = $conv6
    finalResponse = $r2.message
}

# Conversation 7: User wants to share case
Write-Host "`n=== Conversation 7: User wants to share case ===" -ForegroundColor Cyan
$conv7 = @()
$case7 = @{
    id = "nina-case-7"
    name = "Nina"
    description = "Nina necesita un hogar temporal."
    status = "active"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "María González"
    bankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "Me encantó la historia de Nina. ¿Cómo puedo compartirla en mis redes sociales?" -caseData $case7
$conv7 += @{role='user'; content='Me encantó la historia de Nina. ¿Cómo puedo compartirla en mis redes sociales?'; timestamp='2024-01-01T10:00:00Z'}
$conv7 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "Perfecto, ya la compartí. ¿Eso también me da Totitos?" -caseData $case7 -conversationHistory $conv7
$results += @{
    conversation = 7
    scenario = "User wants to share case"
    messages = $conv7
    finalResponse = $r2.message
}

# Conversation 8: User asks about adoption
Write-Host "`n=== Conversation 8: User asks about adoption ===" -ForegroundColor Cyan
$conv8 = @()
$case8 = @{
    id = "toby-case-8"
    name = "Toby"
    description = "Toby está listo para adopción."
    status = "active"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "María González"
    bankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "Me interesa adoptar a Toby. ¿Cómo funciona el proceso de adopción?" -caseData $case8
$conv8 += @{role='user'; content='Me interesa adoptar a Toby. ¿Cómo funciona el proceso de adopción?'; timestamp='2024-01-01T10:00:00Z'}
$conv8 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "¿Qué requisitos necesito cumplir?" -caseData $case8 -conversationHistory $conv8
$results += @{
    conversation = 8
    scenario = "User asks about adoption"
    messages = $conv8
    finalResponse = $r2.message
}

# Conversation 9: User asks about multiple cases
Write-Host "`n=== Conversation 9: User asks about multiple cases ===" -ForegroundColor Cyan
$conv9 = @()
$case9 = @{
    id = "luna-case-9"
    name = "Luna"
    description = "Luna necesita cirugía."
    status = "active"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "María González"
    bankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "Quiero ayudar a varios casos. ¿Puedo donar a múltiples animales a la vez?" -caseData $case9
$conv9 += @{role='user'; content='Quiero ayudar a varios casos. ¿Puedo donar a múltiples animales a la vez?'; timestamp='2024-01-01T10:00:00Z'}
$conv9 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "¿Y si quiero donar a casos de diferentes guardianes?" -caseData $case9 -conversationHistory $conv9
$results += @{
    conversation = 9
    scenario = "User asks about multiple cases"
    messages = $conv9
    finalResponse = $r2.message
}

# Conversation 10: Confused user needs clarification
Write-Host "`n=== Conversation 10: Confused user needs clarification ===" -ForegroundColor Cyan
$conv10 = @()
$case10 = @{
    id = "chico-case-10"
    name = "Chico"
    description = "Chico necesita atención veterinaria."
    status = "active"
    animalType = "dog"
    location = "Buenos Aires"
    guardianName = "María González"
    bankingAlias = "maria.gonzalez.rescate"
}

$r1 = Send-Message -message "No entiendo cómo funciona esto. ¿Cómo dono? ¿Es a través de la plataforma?" -caseData $case10
$conv10 += @{role='user'; content='No entiendo cómo funciona esto. ¿Cómo dono? ¿Es a través de la plataforma?'; timestamp='2024-01-01T10:00:00Z'}
$conv10 += @{role='assistant'; content=$r1.message; timestamp='2024-01-01T10:00:01Z'}

$r2 = Send-Message -message "Entonces, ¿hago la transferencia desde mi banco directamente al alias?" -caseData $case10 -conversationHistory $conv10
$conv10 += @{role='user'; content='Entonces, ¿hago la transferencia desde mi banco directamente al alias?'; timestamp='2024-01-01T10:00:02Z'}
$conv10 += @{role='assistant'; content=$r2.message; timestamp='2024-01-01T10:00:03Z'}

$r3 = Send-Message -message "Perfecto, ya entendí. Gracias!" -caseData $case10 -conversationHistory $conv10
$results += @{
    conversation = 10
    scenario = "Confused user needs clarification"
    messages = $conv10
    finalResponse = $r3.message
}

# Save results
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath "conversation-results.json" -Encoding UTF8

Write-Host "`n=== All conversations completed ===" -ForegroundColor Green
Write-Host "Results saved to conversation-results.json" -ForegroundColor Green

# Display summary
Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
foreach ($result in $results) {
    Write-Host "`nConversation $($result.conversation): $($result.scenario)" -ForegroundColor Cyan
    Write-Host "Final response preview: $($result.finalResponse.Substring(0, [Math]::Min(100, $result.finalResponse.Length)))..." -ForegroundColor Gray
}


