require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { response } = require("express");

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

mongoose.connect("mongodb://localhost:27017/users-data");

const userSchema = new mongoose.Schema({
      username: String,
      followers: {type: [ mongoose.ObjectId], default: [] },
      following: {type: [ mongoose.ObjectId ], default: []},
      mail: String,
      passHash: String,
      likedPosts: { type: [mongoose.ObjectId], default: [] }        // ids of the liked posts
});

const commentSchema = new mongoose.Schema({
      comment: String,
      commentBy: String                    // mail of the user who commented    
});

const postSchema = new mongoose.Schema({
      createdBy: String,             // mail of the user who created the post
      title: String,
      desc: String,
      comments: { type: [mongoose.ObjectId], default: [] },
      likes: { type: Number, default: 0 },
      created_at: Date
});

const User = new mongoose.model("User", userSchema);
const Comment = new mongoose.model("Comment", commentSchema);
const Post = new mongoose.model("Post", postSchema);

app.post("/api/register", (req,res) => {
    const { username, mail, password } = req.body;

    bcrypt.hash(password,10, function(err,hash){
           if(err){
             res.send(err);
           }else{
               const newUser = new User({
                   username: username,
                   mail: mail,
                   passHash: hash
               });
               newUser.save();
               res.send("Successfuly registered!");
           }
    });
});

app.post("/api/authenticate", (req,res) => {
    const { mail, password } = req.body;

    User.findOne( { mail: mail }, (err,user) => {
         if(err){
             res.send(err);
         }else if(user && bcrypt.compare(password,user.passHash)){
             const token = jwt.sign( req.body, process.env.JWT_SECRET_KEY, { expiresIn: '1d'});  
             res.send(token);
         }else{
             res.send("User not found!");
         }
    });
});

app.post("/api/follow/:userId", authenticate ,(req,res) => {
    
    const userId = req.params.userId;

    User.findOne( { mail: req.user.mail }, (err,user) => {
         if(err){
             res.send(err);
         }else{
             const following = user.following.filter( followed => followed.toString() === userId ).length;
             if(following !== 0){
                 res.send("User is already followed!");
             }else{
                 User.findOne( { _id: userId }, (error,followUser) => {
                      if(error){
                          res.send(error);
                      }else{
                          if(followUser){
                             followUser.followers.push(user._id);
                             user.following.push(followUser._id);
                             user.save();
                             followUser.save();
                             res.send("Success!");
                          }else{
                              res.send("User not found!");
                          }
                      }
                 });
             }
         }
    });

});

app.post("/api/unfollow/:userId", authenticate ,(req,res) => {
    
    const userId = req.params.userId;

    User.findOne( { mail: req.user.mail }, (err,user) => {
         if(err){
             res.send(err);
         }else{
             const following = user.following.filter( followed => followed.toString() !== userId );
             user.following = following;
             user.save();
             User.findOne( { _id: userId } ,(error, followedUser) => {
                  if(error){
                      res.send(error);
                  }else if(followedUser){
                      const followers = followedUser.followers.filter( follower => follower._id.toString() !== user._id.toString());
                      followedUser.followers = followers;
                      followedUser.save();
                      res.send("Success!");
                  }else{
                    res.send("User not found!");
                  }
             });
         }
    });

});

app.post("/api/user", authenticate, (req,res) => {

    User.findOne( { mail: req.user.mail }, (err, user) => {
         if(err){
             res.send(err);
         }else if(user){
             res.send({
                 username: user.username,
                 followers: user.followers.length,
                 followings: user.following.length
             });
         }else{
             res.send("Usre not found!");
         }
    });
});

app.post("/api/posts", authenticate, (req,res) => {
    const { title, description } = req.body;
    
    const newPost = new Post({
        title: title,
        desc: description,
        createdBy: req.user.mail,
        created_at: new Date()
    });
    newPost.save();
    res.send({
        postId: newPost._id,
        title: newPost.title,
        description: newPost.desc,
        createdTime: newPost.created_at.getTime()
    });
});

app.delete("/api/posts/:postId", authenticate, (req,res) => {
    
    const postId = req.params.postId;

    Post.findOne({ _id: postId}, (err, post) => {
         if(err){
             res.send(err);
         }else if(post && post.createdBy === req.user.mail){
             Post.deleteOne( { _is: postId }, (error) => {
                  if(error) res.send(error);
                  else res.send("Deleted the post!");
             });
         }else{
             res.send("Post with the given id doesn't exists or user is not authorized to delete the post!")
         }
    });
});

app.post("/api/like/:postId", authenticate, (req,res) => {
    
    const postId = req.params.postId;
    User.findOne({mail: req.user.mail}, (err,user) => {
         if(err){
             res.send(err);
         }else if(user){
             if(user.likedPosts.filter( likedPost => likedPost.toString() === postId).length !== 0){
                 res.send("Post is already liked by the user.")
             }else{
                 user.likedPosts.push(postId);
                 user.save();
                 Post.findOne({_id: postId}, (error, post) => {
                      if(error){
                          res.send(error);
                      }else{
                          post.likes++;
                          post.save();
                          res.send("Liked the post!");
                      }
                 });
             }
         }else{
             res.send("User not found!")
         }
    })
});

app.post("/api/unlike/:postId", authenticate, (req,res) => {

    const postId = req.params.postId;

    User.findOne({ mail: req.user.mail}, (err,user) => {
         if(err){
             res.send(err);
         }else if(user){
             if(user.likedPosts.filter( likedPost => likedPost.toString() === postId).length === 1){
                 const likedPosts = user.likedPosts.filter( likedPost => likedPost.toString() !== postId);
                 user.likedPosts = likedPosts;
                 user.save();
                 Post.findOne({_id: postId}, (error,post) =>{
                      if(error){
                          res.send(error);
                      }else{
                          post.likes--;
                          post.save();
                          res.send("Post unliked!");
                      }
                 });
             }else{
                 res.send("The user didn't like the post")
             }
         }else{
             res.send("User not found!");
         }
    });
});

app.post("/api/comment/:postId", authenticate,(req,res) => {
    
    const postId = req.params.postId;
    
    Post.findOne({_id: postId}, (err,post) => {
          if(err){
              res.send(err);
          }else if(post){
            const comment = new Comment({
                comment: req.body.comment,
                commentBy: req.user.mail
            });
            comment.save();
            post.comments.push(comment._id);
            post.save();
            res.send("Posted comment");
          }else{
              res.send("Post doesn't exists!");
          }
    });

});

app.get("/api/posts/:postId", (req,res) =>{
    
    const postId = req.params.postId;
    Post.findOne( { _id: postId }, (err,post) =>{
         if(err){
             res.send(err);
         }else if(post){
             const comments = [];
             Comment.find( { _id: {$in: post.comments} }, (error,comnts) =>{
                     if(error){
                         res.send(error);
                     }else{
                         comnts.map( cmnt =>{
                             const cnt = {
                                 comment: cmnt.comment,
                                 commentBy: cmnt.commentBy
                             }
                             comments.push(cnt)
                         });
                         res.send({
                             likes: post.likes,
                             comments: comments,
                             commentsCount: comments.length
                         });
                     }
             });
         }else{
             res.send("Post not found!");
         }
    });
});

app.get("/api/all_posts", authenticate, (req,res) =>{
    
    Post.find( { createdBy: req.user.mail }, function(err,posts){
         if(err){
             res.send(err);
         }else if(posts.length !== 0){
             const psts = [];
             posts.forEach( async (post, ind) => {
                   const comments = await Comment.find( { _id: { $in: post.comments } })
                   post.comments = comments;
                   psts[ind] = {
                       id: post._id,
                       title: post.title,
                       desc: post.desc,
                       created_at: post.created_at,
                       comments: comments,
                       likes: post.likes
                   };
                   if(ind === posts.length -1){
                      res.send(psts);
                   }
             });
         }else{
             res.send("No posts");
         }
    });

});

// middle-ware to authenticate users
function authenticate(req,res,next){
         
    const authHeader = req.headers['authorization']; // or req.headers['Authorization']

    // bearer token is sent in the folloeing format - Bearer <token>
    const token = authHeader && authHeader.split(' ')[1];
    
    if(token == null){
        res.send("Token not found in the header");
    }else{
        jwt.verify( token, process.env.JWT_SECRET_KEY, function(err,user){
            if(err){
                res.send("Authorization failed!");
            }else{
                req.user = user;
                next();
            }
        });
    }

}

app.listen(3000, () =>{
    console.log("Server started at port 3000");
});