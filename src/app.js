import express from "express"
import cors from "cors"

// Crianção do app:
const app = express()

// Configurações:
app.use(cors())
app.use(express.json())


const participants  = []

let globalParticipant = {
    name: "",
    lastStatus: ""
}

// Funções (endpoints):
app.post("/participants", (req,res) => {
    const {name} = req.body

    if(name === "") {
        return res.sendStatus(422)
    }
    if(participants.find((p) => p.name === name)) {
        return res.sendStatus(409)
    }

    globalParticipant = {
        name: name,
        lastStatus: Date.now()
    }
    
    participants.push(globalParticipant)
    console.log("Array de globParticipantes:", participants)
    res.sendStatus(200)
})


app.get("/participants", (req, res) => {
   res.send(participants)
})

// Ligar a aplicação do servidos para ouvir as requisições:
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))