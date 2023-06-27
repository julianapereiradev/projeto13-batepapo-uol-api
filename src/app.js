import express from "express"
import cors from "cors"

// Crianção do app:
const app = express()

// Configurações:
app.use(cors())
app.use(express.json())


const participants  = []
const messages = []

let postParticipant = {
    name: "",
    lastStatus: ""
}

let postMessages = {
    to: "",
    text: "",
    type: "",
    from: "",
    time: ""
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

    postParticipant = {
        name: name,
        lastStatus: Date.now()
    }
    
    participants.push(postParticipant)
    console.log("Array de postParticipantes:", participants)
    res.sendStatus(201)
})


app.get("/participants", (req, res) => {
   res.send(participants)
})

app.post("/messages", (req, res) => {
    const {to, text, type} = req.body
    const User = req.headers.user

    if(!to || to === "" || !text || text === "") {
        return res.status(422).send("O to ta string vazia ou o text tá string vazia")
    }
    if(!type || type !== "private_message" && type !== "message") {
        return res.status(422).send("type é diferente de message e de private_message")
    }
    if(!User) {
        return res.status(422).send("Usuario não existe")
    }

    const userExists = participants.find((u) => u.name === User)
    console.log("usuario(user) aqui:", User)

    if(!userExists) {
        return res.status(422).send("O user do header não consta no array de participants")
    }

    postMessages = {
        to: "",
        text: "",
        type: "",
        from: User,
        time: "HH:mm:ss"
    }

    messages.push(postMessages)
    // console.log("Array de postMessages:", messages)
    res.sendStatus(201)
})

// Ligar a aplicação do servidos para ouvir as requisições:
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))