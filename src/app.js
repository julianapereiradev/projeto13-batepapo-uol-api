import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

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

const timeFormat = dayjs().format("HH:mm:ss");

const participants = [];
const messages = [];

let postParticipant = {
  name: "",
  lastStatus: "",
};

let postMessages = {
  to: "",
  text: "",
  type: "",
  from: "",
  time: "",
};

// Funções (endpoints):
app.post("/participants", (req, res) => {
  const { name } = req.body;

  if (!name || name === "") {
    return res
      .status(422)
      .send("O campo name é obrigatório e não pode ser string vazia");
  }

  const promise = db.collection("participantes").findOne({ name });

  promise.then((contatoExistente) => {
    if (contatoExistente) {
      res.status(409).send("Já existe um participante com o mesmo nome!");
      return;
    }

    const newParticipant = { name, lastStatus: Date.now() };
    const insertPromise = db
      .collection("participantes")
      .insertOne(newParticipant);

    insertPromise.then(() => {
      const mensagem = {
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: timeFormat,
      };

      const insertMensagemPromise = db
        .collection("mensagens")
        .insertOne(mensagem);

      insertMensagemPromise.then(() => {
        res.sendStatus(201);
      });

      insertMensagemPromise.catch((err) => {
        res.status(500).send(err.message);
      });
    });

    insertPromise.catch((err) => {
      res.status(500).send(err.message);
    });
  });

  promise.catch((err) => {
    res.status(500).send(err.message);
  });
});

app.get("/participants", (req, res) => {
  const promise = db.collection("participantes").find().toArray();

  promise.then((data) => {
    return res.send(data);
  });
  promise.catch((err) => {
    return res.status(500).send(err.message);
  });
});

app.post("/messages", (req, res) => {
  // const {to, text, type} = req.body
  // const User = req.headers.user

  // if(!to || to === "" || !text || text === "") {
  //     return res.status(422).send("O to ta string vazia ou o text tá string vazia")
  // }
  // if(!type || type !== "private_message" && type !== "message") {
  //     return res.status(422).send("type é diferente de message e de private_message")
  // }
  // if(!User) {
  //     return res.status(422).send("Usuario não existe")
  // }

  // const userExists = participants.find((u) => u.name === User)
  // console.log("User de messages aqui:", User)

  // if(!userExists) {
  //     return res.status(422).send("O user do header não consta no array de participants")
  // }

  // postMessages = {
  //     to: to,
  //     text: text,
  //     type: type,
  //     from: User,
  //     time: "HH:mm:ss"
  // }

  // messages.push(postMessages)
  // // console.log("Array de postMessages:", messages)
  // res.sendStatus(201)

  const { to, text, type } = req.body;
  const User = req.headers.user;
  console.log("User aqui:", User);

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

  const promise = db.collection("participantes").findOne({ name: User });

  promise.then((contatoExistente) => {
    if (!contatoExistente) {
      res
        .status(422)
        .send(
          "O participante do cabeçalho 'user' não consta na lista de participantes."
        );
      return;
    }

    const newMessage = { to, text, type, from: User, time: timeFormat };
    const insertPromise = db.collection("mensagens").insertOne(newMessage);

    insertPromise.then(() => {
      res.sendStatus(201);
    });

    insertPromise.catch((err) => {
      res.status(500).send(err.message);
    });
  });

  promise.catch((err) => {
    res.status(500).send(err.message);
  });
});

app.get("/messages", (req, res) => {
  //PARTE DE RETORNAR MENSAGENS QUE USA O OPERADOR $or

  const limit = Number(req.query.limit);

  if (req.query.limit && (isNaN(limit) || limit < 1)) {
    return res
      .status(422)
      .send(
        "Caso o limite seja um valor inválido (0, negativo ou string não numérica)"
      );
  }

  const promise = db.collection("mensagens").find().toArray();

  promise.then((data) => {
    if (limit) {
      return res.send(data.slice(-limit));
    }

    return res.send(data);
  });
  promise.catch((err) => {
    return res.status(500).send(err.message);
  });
});

app.post("/status", (req, res) => {
  // const userExists = participants.find((u) => u.name === User)
  // console.log("User de status aqui:", User)

  // if(!userExists) {
  //     return res.status(404).send("Status 404: Caso este participante não conste na lista de participantes, deve ser retornado um status 404. ")
  // }

  // console.log('userExists antes:',userExists)
  // userExists.lastStatus = Date.now()
  // console.log('userExists depois:',userExists)

  // res.sendStatus(200)

  const User = req.headers.user;
  if (!User) {
    return res.status(404).send("O cabeçalho 'user' é obrigatório.");
  }

  const promise = db.collection("participantes").findOne({ name: User });

  promise.then((contatoExistente) => {
    if (!contatoExistente) {
      res
        .status(404)
        .send(
          "O participante do cabeçalho 'user' não consta na lista de participantes."
        );
      return;
    }
 
    const promiseUpdate = db.collection("participantes").findOneAndUpdate(
        { name: User },
        { $set: { lastStatus: Date.now() } }
      );
    
      promiseUpdate.then(() => {
        res.status(200).send("Status post feito com sucesso!");
      });
    
      promiseUpdate.catch((err) => {
        res.status(500).send(err.message);
      });
});

  promise.catch((err) => {
    res.status(500).send(err.message);
  });
});

// Ligar a aplicação do servidos para ouvir as requisições:
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
