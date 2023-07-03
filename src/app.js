import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from 'joi'

// Crianção do app:
const app = express();

// Configurações:
app.use(cors());
app.use(express.json());
dotenv.config();

//Conexão com o Banco:
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

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().regex(/^(message|private_message)$/).required(),
  from: joi.required()
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

  try {
  const participantExistsInParticipants = await db.collection("participants").findOne({ name });

  if(participantExistsInParticipants) {
    return res.sendStatus(409);
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

  const postMessage = { to: to, text: text, type: type, from: User }

  const validation = messageSchema.validate(postMessage, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const contatoExistente = await db
      .collection("participants")
      .findOne({ name: User });

    if (!contatoExistente) {
      return res.sendStatus(422)
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
    return res.sendStatus(422)
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


app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
  const User = req.headers.user;
  const { ID_DA_MENSAGEM } = req.params;

  try {
    const message = await db.collection("messages").findOne({
      _id: new ObjectId(ID_DA_MENSAGEM)
    });

    if (!message) {
      return res.sendStatus(404);
    }

    if (message.from !== User) {
      return res.sendStatus(401);
    }

    await db.collection("messages").deleteOne({ _id: new ObjectId(ID_DA_MENSAGEM) });

     return res.sendStatus(200);

  } catch (err) {
    return res.status(500).send(err.message);
  }
});

app.put("/messages/:ID_DA_MENSAGEM", async (req, res) => {
  const User = req.headers.user;
  const { ID_DA_MENSAGEM } = req.params;
  const { to, text, type } = req.body;

  const putMessage = { to: to, text: text, type: type, from: User }

  const validation = messageSchema.validate(putMessage, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const contatoExistente = await db
      .collection("participants")
      .findOne({ name: User });

    if (!contatoExistente) {
      return res.sendStatus(422)
    }


    const message = await db.collection("messages").findOne({
      _id: new ObjectId(ID_DA_MENSAGEM)
    });

    if (!message) {
      return res.sendStatus(404);
    }

    if (message.from !== User) {
      return res.sendStatus(401);
    }


    const result = await db.collection("messages").updateOne(
			{ _id: new ObjectId(ID_DA_MENSAGEM) },
			{ $set: { to, text, type } }
		)

		if (result.matchedCount === 0) {
     return res.sendStatus(404)
    }


		res.send("Mensagem atualizada!")

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/status", async (req, res) => {

  const User = req.headers.user;

  if (!User) {
    return res.sendStatus(404);
  }

  try {
    const participantExistsInStatus = await db.collection("participants").findOne({ name: User });

    if(!participantExistsInStatus) {
      return res.sendStatus(404);
    }

    await db.collection("participants").findOneAndUpdate({ name: User }, { $set: { lastStatus: Date.now() } });

    res.sendStatus(200)
  }

  catch(err){
    res.status(500).send(err.message)
  }
});

 // Removing Inactive Participants: 
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
