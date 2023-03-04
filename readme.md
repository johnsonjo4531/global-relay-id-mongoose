# global-relay-id-mongoose

Mongoose helpers to add relay compatible object identification to your GraphQL Schema. 

## What

> The two core assumptions that Relay makes about a GraphQL server are that it provides:
> 
> 1. A mechanism for refetching an object.
> 2. A description of how to page through connections.
> - [GraphQL Relay Server Specification Docs](https://relay.dev/docs/guides/graphql-server-specification/)

This library achieves number 1 with mongoose (looking for how to achieve number 2 with mongoose? Check out my other library: [mongoose-relay-paginate](https://www.npmjs.com/package/mongoose-relay-paginate).)

The number 1 part of the above is known in the relay docs as [Object Identification](https://relay.dev/docs/guides/graphql-server-specification/#object-identification).

Object Identification involves sending identifiers about any collection to the client and being able to refetch them using a single endpoint. This library provides such a way to send an identifier which is globally unique across your schemas and which may be refetched using this library.

> ⚠️ WARNING ⚠️
> It also creates a dataloader to load the node from, so do remember to create a new context per request by calling the default
> exported function atleast once per request or you could get data meant for one user sent to another.



## Why

Object identification in relay allows you to refetch a given node from your server. If you are using relay-client this is useful, because it will help relay to have simple caching object lookups for updating UI.

## How

### Simple example:

```ts
import GlobalRelayIdMongoose from "global-relay-id-mongoose";
// WARNING!!! Make sure to create a handler once for every seperate request since it has a dataloader!!!!!! 
// Otherwise you could get data meant for one user sent to another...
const handler = GlobalRelayIdMongoose([UserModel]);
const user = await UserModel.findOne({});
if (!user?._id) throw new Error("No _id!");

// This should happen on the server to send a response to the client
const id = handler.toID(UserModel, user._id);
// This should happen on the server when getting a request from the client with the identifier.
const node = await handler.node(id);

expect(node).toStrictEqual(user);
```

### TypeGraphQL example

The below examples uses type-graphql. TypeGraphQL is not required, but it is my preferred graphql implementation. Feel free to contribute to this readme to add your graphql implementation.

Here's our resolver this returns the ID identifier. We have to set this up for each Node that implements our node interface:


```ts
@Resolver(_type => Recipe)
export class RecipeResolver {
	@FieldResolver(_type => ID, {
		description:
			"This field brings relay's node interface to our schema, and it acts as the id for our schema!",
	})
	id(
		@Root() root: Recipe,
    // The library is sent in via context on the `node` prop.
		@Ctx() { db, node }: MyContext
	): string {
    // notice the use of the library here since this is the 
    // ID field resolver we will send back the globally unique ID.
		return node.toID(db.models.Recipe, root._id);
	}
}
```

Then we make the node's queryable through a node query with the identifier as an argument:

```ts
@ArgsType()
export class NodeArgs {
	@Field(() => CustomScalars.ID)
	id!: IDInput;
}

@Resolver(_type => NodeInterface)
export class NodeResolver {
	@Query(_type => NodeInterface, {
		description: "This field queries any given node in our schema!",
	})
	node(
		@MyRoot() root: NodeInterface,
		@Args() { id }: NodeArgs,
		@Ctx() { node }: MyContext
	) {
		return node.node(id);
	}
}
```

Finally we setup our context:

```ts
import GlobalRelayIdMongoose, {MongooseGlobalIDReturn} from "global-relay-id-mongoose";

const db = {
  models: {
    // A mongoose model
    Recipe: RecipeModel
  }
} as const;


interface MyContext {
  db: typeof db;
  node: MongooseGlobalIDReturn<(typeof db)["models"][string]>;
}


const schema = new ApolloServer({
  schema: await buildSchema({
    resolvers: [RecipeResolver, NodeResolver],
  }),
  context (context): MyContext {
    return {
      db,
      // Using this libraries primary default export 
      node: GlobalRelayIdMongoose(Object.values(db.models)),
      // etc...
    }
  },
});
```
