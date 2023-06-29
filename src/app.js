import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from 'joi'

// Crianção do app:
const app = express();

// Configurações:
app.use(cors());
app.use(express.json());
dotenv.config();

//Conexão com o Banco (é sempre igual essa conexão basta copiar):
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch((err) => console.log(err.message));

//Dayjs:
const timeFormat = dayjs().format("HH:mm:ss");


//Joi Schemas:
const participantSchema = joi.object({
    name: joi.string().required(),
});


// Funções (endpoints):
app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const postParticipant = { name: name }

  const validation = participantSchema.validate(postParticipant, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try{
  const participantExistsInParticipants = await db.collection("participants").findOne({ name });

  if(participantExistsInParticipants) {
    return res.status(409).send("Já existe um participante com o mesmo nome!");
  }

    const newParticipant = { name, lastStatus: Date.now() };
    await db.collection("participants").insertOne(newParticipant);
    
    const mensagem = {
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: timeFormat,
    };

    await db.collection("messages").insertOne(mensagem);
    res.sendStatus(201)

} catch(err) {
    return res.status(500).send(err.message)
}
});

app.get("/participants", async (req, res) => {
  try {
    const data = await db.collection("participants").find().toArray();
    return res.send(data);

  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const User = req.headers.user;
  console.log("User aqui:", User);

  try {
    if (!to || to === "" || !text || text === "") {
      return res
        .status(422)
        .send("O to ta string vazia ou o text tá string vazia");
    }
    if (!type || (type !== "private_message" && type !== "message")) {
      return res
        .status(422)
        .send("type é diferente de message e de private_message");
    }
    if (!User) {
      return res.status(422).send("O cabeçalho 'user' é obrigatório.");
    }

    const contatoExistente = await db
      .collection("participants")
      .findOne({ name: User });

    if (!contatoExistente) {
      return res
        .status(422)
        .send(
          "O participante do cabeçalho 'user' não consta na lista de participantes."
        );
    }

    const newMessage = { to, text, type, from: User, time: timeFormat };
    await db.collection("messages").insertOne(newMessage);
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});


app.get("/messages", async (req, res) => {
   const User = req.headers.user;

   const limit = Number(req.query.limit);

  if (req.query.limit && (isNaN(limit) || limit < 1)) {
    return res
      .status(422)
      .send(
        "Caso o limite seja um valor inválido (0, negativo ou string não numérica)"
      );
  }

  try {

    const data = await db.collection("messages").find({
      $or: [
          { to: User },
          { from: User },
          { to: "Todos" },
          { type: "status" },
          { type: "message"}
      ]
    }).toArray()

    if(limit) {
        return res.send(data.slice(-limit))
    }

    return res.send(data)
  }

  catch(err) {
    return res.status(500).send(err.message)
  }
});


app.post("/status", async (req, res) => {

  const User = req.headers.user;

  if (!User) {
    return res.status(404).send("O cabeçalho 'user' é obrigatório.");
  }

  try {
    const participantExistsInStatus = await db.collection("participants").findOne({ name: User });

    if(!participantExistsInStatus) {
        return res.status(404).send("O participante do cabeçalho 'user' não consta na lista de participantes.")
    }

    await db.collection("participants").findOneAndUpdate({ name: User }, { $set: { lastStatus: Date.now() } });

    res.sendStatus(200)
  }

  catch(err){
    res.status(500).send(err.message)
  }
});

  setInterval(async () => {
    const participants = await db.collection("participants");

    participants.find().forEach(async (participant) => {
      const lastStatusPlus10Seconds = participant.lastStatus + 10000;

      if (lastStatusPlus10Seconds < Date.now()) {
        await participants.deleteOne({ _id: participant._id });

        const mensagem = {
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: timeFormat,
        };

        await db.collection("messages").insertOne(mensagem);

        console.log("Mensagem de saída registrada:", mensagem);
      }
    });
  }, 15000);


// Ligar a aplicação do servidos para ouvir as requisições:
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
